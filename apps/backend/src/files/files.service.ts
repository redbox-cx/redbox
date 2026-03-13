import { Injectable, BadRequestException, InternalServerErrorException, ForbiddenException, NotFoundException, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import { join } from 'path';
import { Redis } from 'ioredis';
import { pipeline, finished } from 'stream/promises';
import { InjectRedis } from '@nestjs-modules/ioredis';
import * as bcrypt from 'bcryptjs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { addDays } from 'date-fns';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class FilesService {
    private readonly logger = new Logger(FilesService.name);
    private readonly uploadFolder = process.env.UPLOAD_LOCATION || './uploads';
    private readonly tempFolder = join(this.uploadFolder, 'temp');
    private readonly MAX_QUOTA = 2 * 1024 * 1024 * 1024; // 2GB

    constructor(
        private prisma: PrismaService,
        @InjectRedis() private readonly redis: Redis 
    ) {
        if (!fs.existsSync(this.tempFolder)) fs.mkdirSync(this.tempFolder, { recursive: true });
    }

    async initializeUpload(userId: string, fileSize: number, totalChunks: number, password?: string) {
        // Quota Check
        const aggregation = await this.prisma.file.aggregate({
            where: { userId },
            _sum: { size: true },
        });
        const currentUsage = aggregation._sum?.size || 0;

        if (fileSize > this.MAX_QUOTA) throw new BadRequestException('File too large');
        if (currentUsage + fileSize > this.MAX_QUOTA) throw new BadRequestException('Quota exceeded');

        const uploadId = uuidv4();
        
        // hash pw if one was set
        const passwordHash = password 
        ? await bcrypt.hash(password, 12) 
        : null;

        const uploadMetadata = {
            totalChunks,
            nextExpectedChunk: 0,
            fileSize,
            passwordHash
        };

        await this.redis.set(`upload:meta:${userId}:${uploadId}`, JSON.stringify(uploadMetadata), 'EX', 86400);
        return { uploadId };
    }

    async handleChunk(userId: string, uploadId: string, file: Express.Multer.File, chunkIndex: number) {
        if (!file || !file.path) throw new BadRequestException('File data is missing');

        const metaKey = `upload:meta:${userId}:${uploadId}`;
        const metaStr = await this.redis.get(metaKey);

        if (!metaStr) {
            this.cleanupPhysicalFile(file.path);
            throw new BadRequestException('Invalid or expired Upload ID');
        }

        const meta = JSON.parse(metaStr);

        if (Number(chunkIndex) !== meta.nextExpectedChunk) {
            this.cleanupPhysicalFile(file.path);
            throw new BadRequestException(`Wrong chunk order. Expected index ${meta.nextExpectedChunk}`);
        }

        const userTempDir = join(this.tempFolder, `user_${userId}`, uploadId);
        if (!fs.existsSync(userTempDir)) fs.mkdirSync(userTempDir, { recursive: true });

        const chunkPath = join(userTempDir, chunkIndex.toString());
        fs.renameSync(file.path, chunkPath);

        meta.nextExpectedChunk++;
        await this.redis.set(metaKey, JSON.stringify(meta), 'EX', 86400);

        return { message: `Chunk ${chunkIndex} accepted` };
    }

    async finalizeUpload(userId: string, uploadId: string, fileName: string, totalChunks: number, mimetype: string, fileKeyFromFrontend: string) {

        const masterKeyHex = await this.redis.get(`masterkey:${userId}`);
        if (!masterKeyHex) throw new UnauthorizedException('Session expired');
        const masterKey = Buffer.from(masterKeyHex, 'hex');

        const fileKeyIv = randomBytes(16);
        const cipher = createCipheriv('aes-256-cbc', masterKey, fileKeyIv);
        let encryptedFileKey = cipher.update(fileKeyFromFrontend, 'utf8', 'hex');
        encryptedFileKey += cipher.final('hex');


        const userTempDir = join(this.tempFolder, `user_${userId}`, uploadId);
        const finalStorageName = `${uuidv4()}.bin`;
        const finalPath = join(this.uploadFolder, finalStorageName);

        const metaStr = await this.redis.get(`upload:meta:${userId}:${uploadId}`);
        if (!metaStr) throw new BadRequestException('Metadata expired');
        const meta = JSON.parse(metaStr);

        const writeStream = fs.createWriteStream(finalPath);

        try {
            for (let i = 0; i < totalChunks; i++) {
                const chunkPath = join(userTempDir, i.toString());
                if (!fs.existsSync(chunkPath)) throw new Error(`Chunk ${i} fehlt`);

                const readStream = fs.createReadStream(chunkPath);
                await pipeline(readStream, writeStream, { end: false });
                
                fs.unlinkSync(chunkPath);
            }

            writeStream.end();

            await new Promise<void>((resolve) => writeStream.on('finish', () => resolve()));

            fs.rmdirSync(userTempDir);

            const fileRecord = await this.prisma.file.create({
                data: {
                    originalName: fileName,
                    storageName: finalStorageName,
                    size: fs.statSync(finalPath).size,
                    mimetype,
                    userId,
                    passwordHash: meta.passwordHash,
                    expiresAt: addDays(new Date(), 30),
                    encryptedFileKey,
                    fileKeyIv: fileKeyIv.toString('hex')
                },
            });

            await this.redis.del(`upload:meta:${userId}:${uploadId}`);
            return fileRecord;
        } catch (error) {
            if (writeStream) writeStream.destroy();
            throw new InternalServerErrorException('Finalize failed');
        }
    }

    async downloadFile(fileId: string, token: string, providedPassword?: string) {
        // search file
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });
        
        if (!file || file.shareToken !== token) {
            throw new NotFoundException('File not found or invalid token');
        }

        // test expiry
        if (new Date() > file.expiresAt) {
            await this.deleteFileInternal(file.id);
            throw new NotFoundException('File has expired');
        }

        // password-gatekeeper
        if (file.passwordHash) {
            if (!providedPassword) throw new ForbiddenException('This file is password protected');
            const isMatch = await bcrypt.compare(providedPassword, file.passwordHash);
            if (!isMatch) throw new ForbiddenException('Incorrect password');
        }

        // prepare stream
        const filePath = join(this.uploadFolder, file.storageName);
        if (!fs.existsSync(filePath)) throw new InternalServerErrorException('Physical file missing');

        const stream = fs.createReadStream(filePath);

        return {
            stream,
            fileName: file.originalName,
            mimeType: file.mimetype,
        };
    }

    // helpfunction for quota in frontend + decryption-key
    async getUserFilesWithQuota(userId: string) {
        const masterKeyHex = await this.redis.get(`masterkey:${userId}`);
        if (!masterKeyHex) throw new UnauthorizedException('Session expired');
        const masterKey = Buffer.from(masterKeyHex, 'hex');

        const files = await this.prisma.file.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });

        const processedFiles = files.map(file => {
            let decryptedKey = "";
            try {
                const decipher = createDecipheriv('aes-256-cbc', masterKey, Buffer.from(file.fileKeyIv, 'hex'));
                decryptedKey = decipher.update(file.encryptedFileKey, 'hex', 'utf8');
                decryptedKey += decipher.final('utf8');
            } catch (e) { decryptedKey = "error"; }

            return {
                id: file.id,
                originalName: file.originalName,
                size: file.size,
                mimetype: file.mimetype,
                createdAt: file.createdAt,
                expiresAt: file.expiresAt,
                shareLink: `/${file.id}?token=${file.shareToken}#${decryptedKey}`
            };
        });

        const aggregation = await this.prisma.file.aggregate({ where: { userId }, _sum: { size: true } });
        return { files: processedFiles, totalUsed: aggregation._sum.size || 0 };
    }
    // --- CLEANUP & MAINTENANCE ---

    @Cron(CronExpression.EVERY_HOUR)
    async handleCleanup() {
        const expiredFiles = await this.prisma.file.findMany({
            where: { expiresAt: { lt: new Date() } }
        });

        for (const file of expiredFiles) {
            await this.deleteFileInternal(file.id);
            this.logger.log(`Auto-deleted expired file: ${file.originalName}`);
        }
    }

    private async deleteFileInternal(fileId: string) {
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });
        if (file) {
            const path = join(this.uploadFolder, file.storageName);
            if (fs.existsSync(path)) fs.unlinkSync(path);
            await this.prisma.file.delete({ where: { id: fileId } });
        }
    }

    async deleteFile(userId: string, fileId: string) {
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });
        if (!file) throw new NotFoundException('File not found');
        if (file.userId !== userId) throw new ForbiddenException('Not your file');

        await this.deleteFileInternal(fileId);
        return { message: 'Deleted' };
    }

    private cleanupPhysicalFile(path: string) {
        if (fs.existsSync(path)) fs.unlinkSync(path);
    }
}

// Multer Storage Config
export const storageConfig = {
    storage: diskStorage({
        destination: (req, file, callback) => {
            const dest = join(process.env.UPLOAD_LOCATION || './uploads', 'multer_temp');
            if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
            callback(null, dest);
        },
        filename: (req, file, callback) => callback(null, uuidv4()),
    }),
};