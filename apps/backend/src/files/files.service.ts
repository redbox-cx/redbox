import { Injectable, BadRequestException, InternalServerErrorException, ForbiddenException, NotFoundException, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import { join } from 'path';
import { Redis } from 'ioredis';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { pipeline } from 'stream/promises';
import { create } from 'domain';
import { InjectRedis } from '@nestjs-modules/ioredis';

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

    async initializeUpload(userId: number, fileSize: number) {
        const aggregation = await this.prisma.file.aggregate({
            where: { userId },
            _sum: { size: true },
        });
        const currentUsage = aggregation._sum.size || 0;

        if (fileSize > this.MAX_QUOTA) throw new BadRequestException('File too large');
        if (currentUsage + fileSize > this.MAX_QUOTA) throw new BadRequestException('Quota exceeded');

        return { uploadId: uuidv4() };
    }

    async handleChunk(userId: number, uploadId: string, file: Express.Multer.File, chunkIndex: number) {
        const userTempDir = join(this.tempFolder, `user_${userId}`, uploadId);
        if (!fs.existsSync(userTempDir)) fs.mkdirSync(userTempDir, { recursive: true });

        const chunkPath = join(userTempDir, chunkIndex.toString());
        fs.renameSync(file.path, chunkPath);
        return { message: 'Chunk accepted' };
    }

    async finalizeUpload(userId: number, uploadId: string, fileName: string, totalChunks: number, mimetype: string) {
        const userTempDir = join(this.tempFolder, `user_${userId}`, uploadId);
        const finalStorageName = `${uuidv4()}.bin`;
        const finalPath = join(this.uploadFolder, finalStorageName);

        const masterKeyHex = await this.redis.get(`masterkey:${userId}`);
        if (!masterKeyHex) throw new UnauthorizedException('Session expired');
        const masterKey = Buffer.from(masterKeyHex, 'hex');
        const fileIv = randomBytes(16);

        if (!fs.existsSync(userTempDir)) throw new NotFoundException('Chunks not found');

        const writeStream = fs.createWriteStream(finalPath);
        
        // promise
        const streamFinished = new Promise<void>((resolve, reject) => {
            writeStream.on('finish', () => resolve());
            writeStream.on('error', (err) => reject(err));
        });

        try {
            writeStream.write(fileIv);
            const cipher = createCipheriv('aes-256-cbc', masterKey, fileIv);

            for (let i = 0; i < totalChunks; i++) {
                const chunkPath = join(userTempDir, i.toString());
                const chunkContent = fs.readFileSync(chunkPath);
                writeStream.write(cipher.update(chunkContent));
                fs.unlinkSync(chunkPath);
            }
            
            writeStream.write(cipher.final());
            writeStream.end(); // initalize closing

            // wait until stream is finished
            await streamFinished;

            fs.rmdirSync(userTempDir);

            const stats = fs.statSync(finalPath);
            
            return await this.prisma.file.create({
                data: {
                    originalName: fileName,
                    storageName: finalStorageName,
                    size: stats.size,
                    mimetype: mimetype || 'application/octet-stream',
                    userId: userId,
                },
            });
        } catch (error) {
            // close stream if it remains open
            writeStream.destroy();
            this.cleanupPhysicalFile(finalPath);
            console.error("Error:", error);
            throw new InternalServerErrorException('Merge & Encryption failed: ' + error.message);
        }
    }



    async getDecryptionStream(userId: number, file: any) {
        const masterKeyHex = await this.redis.get(`masterkey:${userId}`);
        if (!masterKeyHex) throw new UnauthorizedException('Session expired');
        const masterKey = Buffer.from(masterKeyHex, 'hex');

        const fullPath = join(this.uploadFolder, file.storageName);
        const fileStream = fs.createReadStream(fullPath);

        // read the first 16 Bytes (IV)
        const fd = fs.openSync(fullPath, 'r');
        const iv = Buffer.alloc(16);
        fs.readSync(fd, iv, 0, 16, 0);
        fs.closeSync(fd);

        const decipher = createDecipheriv('aes-256-cbc', masterKey, iv);

        // create new stream which skipps the first 16 Bytes
        const dataStream = fs.createReadStream(fullPath, { start: 16 });

        return { dataStream, decipher };
    }


    async getUserFilesWithQuota(userId: number) {
        // get all files of users
        const files = await this.prisma.file.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }, // newest first
            select: {
                id: true,
                originalName: true,
                size: true,
                mimetype: true,
                createdAt: true,
                // storageName stays hidden (security)
            }
        });

        // calculate storage-usage
        const aggregation = await this.prisma.file.aggregate({
            where: { userId },
            _sum: { size: true },
        });

        const usedBytes = aggregation._sum.size || 0;
        const limitBytes = 2 * 1024 * 1024 * 1024; // 2GB

        return {
            files: files,
            quota: {
                usedBytes: usedBytes,
                limitBytes: limitBytes,
                usedPercentage: parseFloat(((usedBytes / limitBytes) * 100).toFixed(2)),
                availableBytes: limitBytes - usedBytes
            }
        };
    }


    async getFileRecordForUser(userId: number, fileId: string) {
        const file = await this.prisma.file.findUnique({
            where: { id: fileId }
        });
        if (!file) {
            throw new NotFoundException('File not found');
        }
        if (file.userId !== userId) {
            throw new ForbiddenException('You do not have permission to access this file');
        }
        return file;
    }

    // delete-endpoint
    async deleteFile(userId: number, fileId: string) {
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });

        if (!file) throw new NotFoundException('File not found');
        if (file.userId !== userId) throw new ForbiddenException('Not your file');

        // del from hdd
        const fullPath = join(this.uploadFolder, file.storageName);
        this.cleanupPhysicalFile(fullPath);

        // del from db
        return await this.prisma.file.delete({ where: { id: fileId } });
    }

    private cleanupPhysicalFile(path: string) {
        if (fs.existsSync(path)) fs.unlinkSync(path);
    }


    // download-endpoint
    async downloadFile(userId: number, fileId: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');
    if (file.userId !== userId) throw new ForbiddenException('Access denied');


    const masterKeyHex = await this.redis.get(`masterkey:${userId}`);
    if (!masterKeyHex) throw new UnauthorizedException('Session expired');
    const masterKey = Buffer.from(masterKeyHex, 'hex');

    const fullPath = join(this.uploadFolder, file.storageName);
    if (!fs.existsSync(fullPath)) throw new NotFoundException('Physical file missing');

    const fd = fs.openSync(fullPath, 'r');
    const iv = Buffer.alloc(16);
    fs.readSync(fd, iv, 0, 16, 0);
    fs.closeSync(fd);

    const decipher = createDecipheriv('aes-256-cbc', masterKey, iv);
    const dataStream = fs.createReadStream(fullPath, { start: 16 });

    return {
        stream: dataStream.pipe(decipher),
        fileName: file.originalName,
        mimeType: file.mimetype
    };
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