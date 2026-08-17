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
import { createRequiredS3Client, requireBucket } from 'src/common/storage/s3-client';
import { getAdminForwardUsername } from 'src/common/mail/admin-mail-aliases';

const MAX_ACTIVE_UPLOADS_PER_USER = 3;
const UPLOAD_META_TTL_SECONDS = 86400;
const DEFAULT_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024 - 1;
const ADMIN_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 * 1024;
const DEFAULT_FILE_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;
const ADMIN_FILE_QUOTA_BYTES = 50 * 1024 * 1024 * 1024;
const PLAINTEXT_CHUNK_SIZE_BYTES = 50 * 1024 * 1024;
const ENCRYPTED_CHUNK_OVERHEAD_BYTES = 12 + 16;

type UploadMeta = {
    totalChunks: number;
    nextExpectedChunk: number;
    fileSize: number;
    passwordHash: string | null;
    expiresIn: string;
    storageKey: string;
    s3UploadId?: string;
    parts: Array<{ PartNumber: number; ETag?: string }>;
    createdAt?: number;
};

type ActiveUploadCandidate = {
    uploadId: string;
    meta: UploadMeta;
    createdAt: number;
};

@Injectable()
export class FilesService {
    private readonly logger = new Logger(FilesService.name);
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
        await this.getMasterKeyForUser(userId);

        const expectedChunks = Math.ceil(fileSize / PLAINTEXT_CHUNK_SIZE_BYTES);
        if (totalChunks !== expectedChunks) {
            throw new BadRequestException(`Invalid chunk count. Expected ${expectedChunks}`);
        }

        await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { username: true },
            });
            if (!user) throw new UnauthorizedException('User not found');

            const limits = this.getFileLimitsForUsername(user.username);
            if (fileSize > limits.maxFileSize) {
                throw new BadRequestException('File too large');
            }

            const aggregation = await tx.file.aggregate({
                where: { userId },
                _sum: { size: true },
            });
            const currentUsage = Number(aggregation._sum?.size ?? 0);
            if (currentUsage + fileSize > limits.quotaLimit) {
                throw new BadRequestException('Quota exceeded');
            }
        });

        const uploadId = uuidv4();
        const storageKey = `${uuidv4()}.bin`;
        const passwordHash = password ? await bcrypt.hash(password, 12) : null;
        let s3UploadId: string | undefined;
        let uploadReserved = false;
        let uploadMetaCreated = false;
        const metaKey = this.getUploadMetaKey(userId, uploadId);

        try {
            const s3Init = await this.s3.send(new CreateMultipartUploadCommand({
                Bucket: this.bucket,
                Key: storageKey,
            }));
            s3UploadId = s3Init.UploadId;

            await this.redis.set(
                metaKey,
                JSON.stringify({
                    totalChunks,
                    nextExpectedChunk: 0,
                    fileSize,
                    passwordHash,
                    expiresIn: expiresIn ?? '30d',
                    storageKey,
                    s3UploadId,
                    parts: [],
                    createdAt: Date.now(),
                } satisfies UploadMeta),
                'EX', UPLOAD_META_TTL_SECONDS
            );
            uploadMetaCreated = true;

            await this.reserveActiveUpload(userId, uploadId);
            uploadReserved = true;

            return { uploadId };
        } catch (error) {
            if (s3UploadId) {
                await this.s3.send(new AbortMultipartUploadCommand({
                    Bucket: this.bucket,
                    Key: storageKey,
                    UploadId: s3UploadId,
                })).catch(() => {});
            }

            if (uploadMetaCreated) {
                await this.redis.del(metaKey);
            }

            if (uploadReserved) {
                await this.releaseActiveUpload(userId, uploadId);
            }

            throw error;
        }
    }

    async handleChunk(userId: string, uploadId: string, file: Express.Multer.File, chunkIndex: number) {
        if (!file || !file.buffer) throw new BadRequestException('File data is missing');

        const metaKey = this.getUploadMetaKey(userId, uploadId);
        const metaStr = await this.redis.get(metaKey);

        if (!metaStr) throw new BadRequestException('Invalid or expired Upload ID');

        const meta = JSON.parse(metaStr) as UploadMeta;

        if (Number(chunkIndex) !== meta.nextExpectedChunk) {
            throw new BadRequestException(`Wrong chunk order. Expected index ${meta.nextExpectedChunk}`);
        }

        if (Number(chunkIndex) >= meta.totalChunks) {
            throw new BadRequestException(`Invalid chunk index. Total chunks is ${meta.totalChunks}`);
        }

        const expectedPlaintextSize = chunkIndex < meta.totalChunks - 1
            ? PLAINTEXT_CHUNK_SIZE_BYTES
            : meta.fileSize - ((meta.totalChunks - 1) * PLAINTEXT_CHUNK_SIZE_BYTES);
        const expectedEncryptedSize = expectedPlaintextSize + ENCRYPTED_CHUNK_OVERHEAD_BYTES;
        if (file.size !== expectedEncryptedSize) {
            throw new BadRequestException(`Invalid chunk size. Expected ${expectedEncryptedSize} bytes`);
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
        const masterKey = await this.getMasterKeyForUser(userId);

        const fileKeyIv = randomBytes(16);
        const cipher = createCipheriv('aes-256-cbc', masterKey, fileKeyIv);
        let encryptedFileKey = cipher.update(fileKeyFromFrontend, 'utf8', 'hex');
        encryptedFileKey += cipher.final('hex');

        const metaStr = await this.redis.get(this.getUploadMetaKey(userId, uploadId));
        if (!metaStr) throw new BadRequestException('Metadata expired');
        const meta = JSON.parse(metaStr) as UploadMeta;

        if (meta.parts.length !== meta.totalChunks) {
            throw new BadRequestException('Not all chunks uploaded yet');
        }

        let multipartCompleted = false;
        try {
            await this.s3.send(new CompleteMultipartUploadCommand({
                Bucket: this.bucket,
                Key: meta.storageKey,
                UploadId: meta.s3UploadId,
                MultipartUpload: {
                    Parts: meta.parts.sort((a, b) => a.PartNumber - b.PartNumber),
                },
            }));
            multipartCompleted = true;

            const fileRecord = await this.prisma.$transaction(async (tx) => {
                await tx.$queryRaw<Array<{ id: string }>>`
                    SELECT id FROM \`User\` WHERE id = ${userId} FOR UPDATE
                `;

                const user = await tx.user.findUnique({
                    where: { id: userId },
                    select: { username: true },
                });
                if (!user) throw new UnauthorizedException('User not found');

                const limits = this.getFileLimitsForUsername(user.username);
                if (meta.fileSize > limits.maxFileSize) {
                    throw new BadRequestException('File too large');
                }

                const aggregation = await tx.file.aggregate({
                    where: { userId },
                    _sum: { size: true },
                });
                const currentUsage = Number(aggregation._sum?.size ?? 0);
                if (currentUsage + meta.fileSize > limits.quotaLimit) {
                    throw new BadRequestException('Quota exceeded');
                }

                return tx.file.create({
                    data: {
                        originalName: fileName,
                        storageName: meta.storageKey,
                        size: BigInt(meta.fileSize),
                        mimetype,
                        userId,
                        passwordHash: meta.passwordHash,
                        expiresAt: this.calculateExpiration(meta.expiresIn),
                        encryptedFileKey,
                        fileKeyIv: fileKeyIv.toString('hex'),
                    },
                });
            });

            await this.redis.del(`upload:meta:${userId}:${uploadId}`);
            await this.releaseActiveUpload(userId, uploadId);
            return fileRecord;

        } catch (error) {
            if (multipartCompleted) {
                await this.s3.send(new DeleteObjectCommand({
                    Bucket: this.bucket,
                    Key: meta.storageKey,
                })).catch(() => {});
            } else {
                await this.s3.send(new AbortMultipartUploadCommand({
                    Bucket: this.bucket,
                    Key: meta.storageKey,
                    UploadId: meta.s3UploadId,
                })).catch(() => {});
            }

            this.logger.error(`Finalize failed for uploadId ${uploadId}:`, error);
            await this.redis.del(this.getUploadMetaKey(userId, uploadId));
            await this.releaseActiveUpload(userId, uploadId);
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                throw error;
            }
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
        const masterKey = await this.getMasterKeyForUser(userId);

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { username: true },
        });
        if (!user) throw new UnauthorizedException('User not found');

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
                size: Number(file.size),
                mimetype: file.mimetype,
                createdAt: file.createdAt,
                expiresAt: file.expiresAt,
                shareLink: `/d/${file.id}?token=${file.shareToken}#${decryptedKey}`,
            };
        });

        const aggregation = await this.prisma.file.aggregate({ where: { userId }, _sum: { size: true } });
        const limits = this.getFileLimitsForUsername(user.username);
        return {
            files: processedFiles,
            totalUsed: Number(aggregation._sum.size ?? 0),
            quotaLimit: limits.quotaLimit,
            maxFileSize: limits.maxFileSize,
        };
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
        await this.makeRoomForActiveUpload(userId);

        const activeKey = this.getActiveUploadKey(userId);
        await this.redis.sadd(activeKey, uploadId);
        await this.redis.expire(activeKey, UPLOAD_META_TTL_SECONDS);
    }

    private async releaseActiveUpload(userId: string, uploadId: string) {
        await this.redis.srem(this.getActiveUploadKey(userId), uploadId);
    }

    private getActiveUploadKey(userId: string) {
        return `upload:active:${userId}`;
    }

    private getUploadMetaKey(userId: string, uploadId: string) {
        return `upload:meta:${userId}:${uploadId}`;
    }

    private getFileLimitsForUsername(username: string) {
        const adminUsername = getAdminForwardUsername();
        if (adminUsername && username === adminUsername) {
            return {
                maxFileSize: ADMIN_MAX_FILE_SIZE_BYTES,
                quotaLimit: ADMIN_FILE_QUOTA_BYTES,
            };
        }

        return {
            maxFileSize: DEFAULT_MAX_FILE_SIZE_BYTES,
            quotaLimit: DEFAULT_FILE_QUOTA_BYTES,
        };
    }

    private async makeRoomForActiveUpload(userId: string) {
        const activeKey = this.getActiveUploadKey(userId);
        const uploadIds = await this.redis.smembers(activeKey);

        if (uploadIds.length < MAX_ACTIVE_UPLOADS_PER_USER) {
            return;
        }

        const metaKeys = uploadIds.map((uploadId) => this.getUploadMetaKey(userId, uploadId));
        const metaValues = await this.redis.mget(...metaKeys);
        const candidates: ActiveUploadCandidate[] = [];
        const staleUploadIds: string[] = [];
        const staleMetaKeys: string[] = [];

        uploadIds.forEach((uploadId, index) => {
            const metaStr = metaValues[index];
            if (!metaStr) {
                staleUploadIds.push(uploadId);
                return;
            }

            try {
                const meta = JSON.parse(metaStr) as UploadMeta;
                candidates.push({
                    uploadId,
                    meta,
                    createdAt: Number(meta.createdAt ?? 0),
                });
            } catch {
                staleUploadIds.push(uploadId);
                staleMetaKeys.push(metaKeys[index]);
            }
        });

        if (staleUploadIds.length > 0) {
            await this.redis.srem(activeKey, ...staleUploadIds);
        }

        if (staleMetaKeys.length > 0) {
            await this.redis.del(...staleMetaKeys);
        }

        const uploadsToRemove = candidates.length - MAX_ACTIVE_UPLOADS_PER_USER + 1;
        if (uploadsToRemove <= 0) {
            return;
        }

        candidates.sort((a, b) => a.createdAt - b.createdAt);

        for (const candidate of candidates.slice(0, uploadsToRemove)) {
            await this.abortActiveUpload(userId, candidate);
        }
    }

    private async abortActiveUpload(userId: string, candidate: ActiveUploadCandidate) {
        if (candidate.meta.s3UploadId && candidate.meta.storageKey) {
            await this.s3.send(new AbortMultipartUploadCommand({
                Bucket: this.bucket,
                Key: candidate.meta.storageKey,
                UploadId: candidate.meta.s3UploadId,
            })).catch((err) => {
                this.logger.warn(`Failed to abort replaced upload ${candidate.uploadId}: ${err.message}`);
            });
        }

        await this.redis.del(this.getUploadMetaKey(userId, candidate.uploadId));
        await this.releaseActiveUpload(userId, candidate.uploadId);
        this.logger.log(`Replaced active upload ${candidate.uploadId} for user ${userId}`);
    }

    private async getMasterKeyForUser(userId: string) {
        const masterKeyHex = await this.redis.get(`masterkey:${userId}`);
        if (!masterKeyHex) throw new UnauthorizedException('Session expired');

        return Buffer.from(masterKeyHex, 'hex');
    }
}

export const storageConfig = {
    limits: {
        fileSize: 100 * 1024 * 1024, 
    },
    storage: memoryStorage(),
};
