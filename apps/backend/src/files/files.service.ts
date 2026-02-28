import { Injectable, BadRequestException, InternalServerErrorException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';

@Injectable()
export class FilesService {
    private readonly logger = new Logger(FilesService.name);
    private readonly uploadFolder = process.env.UPLOAD_LOCATION || './uploads';
    private readonly tempFolder = join(this.uploadFolder, 'temp');
    private readonly MAX_QUOTA = 2 * 1024 * 1024 * 1024; // 2GB

    constructor(private prisma: PrismaService) {
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

        if (!fs.existsSync(userTempDir)) throw new NotFoundException('Chunks not found');

        const writeStream = fs.createWriteStream(finalPath);
        try {
            for (let i = 0; i < totalChunks; i++) {
                const chunkPath = join(userTempDir, i.toString());
                if (!fs.existsSync(chunkPath)) throw new Error(`Missing chunk ${i}`);
                await pipeline(fs.createReadStream(chunkPath), writeStream, { end: false });
                fs.unlinkSync(chunkPath);
            }
            writeStream.end();
            fs.rmdirSync(userTempDir);

            return await this.prisma.file.create({
                data: {
                    originalName: fileName,
                    storageName: finalStorageName,
                    size: fs.statSync(finalPath).size,
                    mimetype: mimetype || 'application/octet-stream',
                    userId: userId,
                },
            });
        } catch (error) {
            writeStream.end();
            this.cleanupPhysicalFile(finalPath);
            throw new InternalServerErrorException('Merge failed');
        }
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