import { Injectable, BadRequestException, InternalServerErrorException, ForbiddenException, NotFoundException, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import * as bcrypt from 'bcryptjs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { addDays, addHours } from 'date-fns';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import {
    S3Client, CreateMultipartUploadCommand, UploadPartCommand,
    CompleteMultipartUploadCommand, GetObjectCommand, DeleteObjectCommand,
    ListObjectsV2Command, AbortMultipartUploadCommand
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { memoryStorage } from 'multer';
import { RateLimitService } from 'src/common/rate-limit/rate-limit.service';
import { RateLimitExceededException } from 'src/common/rate-limit/rate-limit.exception';
import { createRequiredS3Client, requireBucket } from 'src/common/storage/s3-client';

const MAX_ACTIVE_UPLOADS_PER_USER = 3;
const UPLOAD_META_TTL_SECONDS = 86400;

@Injectable()
export class FilesService {
    private readonly logger = new Logger(FilesService.name);
    private readonly MAX_QUOTA = 2 * 1024 * 1024 * 1024; // 2GB
    private readonly s3: S3Client;
    private readonly bucket = requireBucket('S3_BUCKET_FILES');

    constructor(
        private prisma: PrismaService,
        @InjectRedis() private readonly redis: Redis,
        private readonly rateLimitService: RateLimitService,
    ) {
        this.s3 = createRequiredS3Client();
    }

    private calculateExpiration(expiresIn?: string): Date {
        if (expiresIn === '1h') return addHours(new Date(), 1);
        if (expiresIn === '24h') return addHours(new Date(), 24);
        if (expiresIn === '7d') return addDays(new Date(), 7);

        return addDays(new Date(), 30);
    }

    async initializeUpload(userId: string, fileSize: number, totalChunks: number, password?: string, expiresIn?: string) {
        if (fileSize > this.MAX_QUOTA) throw new BadRequestException('File too large');

        await this.prisma.$transaction(async (tx) => {
            const aggregation = await tx.file.aggregate({
                where: { userId },
                _sum: { size: true },
            });
            const currentUsage = Number(aggregation._sum?.size ?? 0);
            if (currentUsage + fileSize > this.MAX_QUOTA) {
                throw new BadRequestException('Quota exceeded');
            }
        });

        const uploadId = uuidv4();
        const storageKey = `${uuidv4()}.bin`;
        const passwordHash = password ? await bcrypt.hash(password, 12) : null;
        let s3UploadId: string | undefined;
        let uploadReserved = false;

        try {
            await this.reserveActiveUpload(userId, uploadId);
            uploadReserved = true;

            const s3Init = await this.s3.send(new CreateMultipartUploadCommand({
                Bucket: this.bucket,
                Key: storageKey,
            }));
            s3UploadId = s3Init.UploadId;

            await this.redis.set(
                `upload:meta:${userId}:${uploadId}`,
                JSON.stringify({
                    totalChunks,
                    nextExpectedChunk: 0,
                    fileSize,
                    passwordHash,
                    expiresIn: expiresIn ?? '30d',
                    storageKey,
                    s3UploadId,
                    parts: []
                }),
                'EX', UPLOAD_META_TTL_SECONDS
            );

            return { uploadId };
        } catch (error) {
            if (s3UploadId) {
                await this.s3.send(new AbortMultipartUploadCommand({
                    Bucket: this.bucket,
                    Key: storageKey,
                    UploadId: s3UploadId,
                })).catch(() => {});
            }

            if (uploadReserved) {
                await this.releaseActiveUpload(userId, uploadId);
            }

            throw error;
        }
    }

    async handleChunk(userId: string, uploadId: string, file: Express.Multer.File, chunkIndex: number) {
        if (!file || !file.buffer) throw new BadRequestException('File data is missing');

        const metaKey = `upload:meta:${userId}:${uploadId}`;
        const metaStr = await this.redis.get(metaKey);

        if (!metaStr) throw new BadRequestException('Invalid or expired Upload ID');

        const meta = JSON.parse(metaStr);

        if (Number(chunkIndex) !== meta.nextExpectedChunk) {
            throw new BadRequestException(`Wrong chunk order. Expected index ${meta.nextExpectedChunk}`);
        }

        if (Number(chunkIndex) >= meta.totalChunks) {
            throw new BadRequestException(`Invalid chunk index. Total chunks is ${meta.totalChunks}`);
        }

        const partNumber = chunkIndex + 1;

        const uploadResult = await this.s3.send(new UploadPartCommand({
            Bucket: this.bucket,
            Key: meta.storageKey,
            UploadId: meta.s3UploadId,
            PartNumber: partNumber,
            Body: file.buffer,
        }));

        meta.parts.push({ PartNumber: partNumber, ETag: uploadResult.ETag });
        meta.nextExpectedChunk++;

        await this.redis.set(metaKey, JSON.stringify(meta), 'EX', UPLOAD_META_TTL_SECONDS);

        return { message: `Chunk ${chunkIndex} accepted` };
    }

    async finalizeUpload(userId: string, uploadId: string, fileName: string, mimetype: string, fileKeyFromFrontend: string) {
        const masterKeyHex = await this.redis.get(`masterkey:${userId}`);
        if (!masterKeyHex) throw new UnauthorizedException('Session expired');
        const masterKey = Buffer.from(masterKeyHex, 'hex');

        const fileKeyIv = randomBytes(16);
        const cipher = createCipheriv('aes-256-cbc', masterKey, fileKeyIv);
        let encryptedFileKey = cipher.update(fileKeyFromFrontend, 'utf8', 'hex');
        encryptedFileKey += cipher.final('hex');

        const metaStr = await this.redis.get(`upload:meta:${userId}:${uploadId}`);
        if (!metaStr) throw new BadRequestException('Metadata expired');
        const meta = JSON.parse(metaStr);

        if (meta.parts.length !== meta.totalChunks) {
            throw new BadRequestException('Not all chunks uploaded yet');
        }

        try {
            await this.s3.send(new CompleteMultipartUploadCommand({
                Bucket: this.bucket,
                Key: meta.storageKey,
                UploadId: meta.s3UploadId,
                MultipartUpload: {
                    Parts: meta.parts.sort((a, b) => a.PartNumber - b.PartNumber),
                },
            }));

            const fileRecord = await this.prisma.file.create({
                data: {
                    originalName: fileName,
                    storageName: meta.storageKey,
                    size: meta.fileSize,
                    mimetype,
                    userId,
                    passwordHash: meta.passwordHash,
                    expiresAt: this.calculateExpiration(meta.expiresIn),
                    encryptedFileKey,
                    fileKeyIv: fileKeyIv.toString('hex'),
                },
            });

            await this.redis.del(`upload:meta:${userId}:${uploadId}`);
            await this.releaseActiveUpload(userId, uploadId);
            return fileRecord;

        } catch (error) {
            await this.s3.send(new AbortMultipartUploadCommand({
                Bucket: this.bucket,
                Key: meta.storageKey,
                UploadId: meta.s3UploadId,
            })).catch(() => {});

            this.logger.error(`Finalize failed for uploadId ${uploadId}:`, error);
            await this.releaseActiveUpload(userId, uploadId);
            throw new InternalServerErrorException('Finalize failed');
        }
    }

    async downloadFile(fileId: string, token: string, providedPassword?: string, clientIp = 'unknown') {
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });

        if (!file || file.shareToken !== token) {
            throw new NotFoundException('File not found or invalid token');
        }

        if (new Date() > file.expiresAt) {
            await this.deleteFileInternal(file.id);
            throw new NotFoundException('File has expired');
        }

        if (file.passwordHash) {
            if (!providedPassword) throw new ForbiddenException('This file is password protected');
            const passwordAttemptSubject = `file:${file.id}:ip:${clientIp}`;
            await this.rateLimitService.assertAvailable(
                'files:download:password-failure',
                passwordAttemptSubject,
                10,
                15 * 60,
            );
            const isMatch = await bcrypt.compare(providedPassword, file.passwordHash);
            if (!isMatch) {
                await this.rateLimitService.consumeAttempt(
                    'files:download:password-failure',
                    passwordAttemptSubject,
                    10,
                    15 * 60,
                );
                throw new ForbiddenException('Incorrect password');
            }
            await this.rateLimitService.clearAttempts(
                'files:download:password-failure',
                passwordAttemptSubject,
            );
        }

        const s3Response = await this.s3.send(new GetObjectCommand({
            Bucket: this.bucket,
            Key: file.storageName,
        }));

        if (!s3Response.Body) throw new InternalServerErrorException('File not found in storage');

        return {
            stream: s3Response.Body as Readable,
            fileName: file.originalName,
            mimeType: file.mimetype,
        };
    }

    async getUserFilesWithQuota(userId: string) {
        const masterKeyHex = await this.redis.get(`masterkey:${userId}`);
        if (!masterKeyHex) throw new UnauthorizedException('Session expired');
        const masterKey = Buffer.from(masterKeyHex, 'hex');

        const files = await this.prisma.file.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });

        const processedFiles = files.map(file => {
            let decryptedKey = '';
            try {
                const decipher = createDecipheriv('aes-256-cbc', masterKey, Buffer.from(file.fileKeyIv, 'hex'));
                decryptedKey = decipher.update(file.encryptedFileKey, 'hex', 'utf8');
                decryptedKey += decipher.final('utf8');
            } catch (e) {
                decryptedKey = 'error';
            }

            return {
                id: file.id,
                originalName: file.originalName,
                size: file.size,
                mimetype: file.mimetype,
                createdAt: file.createdAt,
                expiresAt: file.expiresAt,
                shareLink: `/d/${file.id}?token=${file.shareToken}#${decryptedKey}`,
            };
        });

        const aggregation = await this.prisma.file.aggregate({ where: { userId }, _sum: { size: true } });
        return { files: processedFiles, totalUsed: aggregation._sum.size || 0 };
    }

    @Cron(CronExpression.EVERY_HOUR)
    async handleCleanup() {
        const expiredFiles = await this.prisma.file.findMany({
            where: { expiresAt: { lt: new Date() } },
        });

        for (const file of expiredFiles) {
            await this.deleteFileInternal(file.id);
            this.logger.log(`Auto-deleted expired file: ${file.originalName}`);
        }
    }

    private async deleteFileInternal(fileId: string) {
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });
        if (file) {
            await this.s3.send(new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: file.storageName,
            })).catch(err => this.logger.warn(`S3 delete failed for ${file.storageName}: ${err.message}`));

            await this.prisma.file.delete({ where: { id: fileId } });
        }
    }

    async deleteFile(userId: string, fileId: string) {
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });
        if (!file) throw new NotFoundException('File not found');
        if (file.userId !== userId) throw new NotFoundException('File not found');

        await this.deleteFileInternal(fileId);
        return { message: 'Deleted' };
    }

    private async reserveActiveUpload(userId: string, uploadId: string) {
        const result = await this.redis.eval(
            `
            local activeCount = redis.call('SCARD', KEYS[1])
            if activeCount >= tonumber(ARGV[2]) then
                return 0
            end
            redis.call('SADD', KEYS[1], ARGV[1])
            redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
            return 1
            `,
            1,
            this.getActiveUploadKey(userId),
            uploadId,
            MAX_ACTIVE_UPLOADS_PER_USER,
            UPLOAD_META_TTL_SECONDS,
        );

        if (Number(result) !== 1) {
            throw new RateLimitExceededException(
                `You can't have more than ${MAX_ACTIVE_UPLOADS_PER_USER} active uploads`,
            );
        }
    }

    private async releaseActiveUpload(userId: string, uploadId: string) {
        await this.redis.srem(this.getActiveUploadKey(userId), uploadId);
    }

    private getActiveUploadKey(userId: string) {
        return `upload:active:${userId}`;
    }
}

export const storageConfig = {
    limits: {
        fileSize: 100 * 1024 * 1024, 
    },
    storage: memoryStorage(),
};
