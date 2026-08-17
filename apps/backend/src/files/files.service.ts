import { Injectable, BadRequestException, InternalServerErrorException, ForbiddenException, NotFoundException, Logger, UnauthorizedException, ConflictException, OnModuleInit } from '@nestjs/common';
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
    ListObjectsV2Command, AbortMultipartUploadCommand, HeadObjectCommand,
    ListMultipartUploadsCommand, ListPartsCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { memoryStorage } from 'multer';
import { RateLimitService } from 'src/common/rate-limit/rate-limit.service';
import { createRequiredS3Client, requireBucket } from 'src/common/storage/s3-client';
import { getAdminForwardUsername } from 'src/common/mail/admin-mail-aliases';

const MAX_ACTIVE_UPLOADS_PER_USER = 1;
const UPLOAD_META_TTL_SECONDS = 86400;
const UPLOAD_INIT_LOCK_TTL_SECONDS = 120;
const INCOMPLETE_UPLOAD_STALE_MS = 60 * 60 * 1000;
const DEFAULT_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024 - 1;
const ADMIN_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 * 1024;
const DEFAULT_FILE_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;
const ADMIN_FILE_QUOTA_BYTES = 50 * 1024 * 1024 * 1024;
const PLAINTEXT_CHUNK_SIZE_BYTES = 50 * 1024 * 1024;
const ENCRYPTED_CHUNK_OVERHEAD_BYTES = 12 + 16;
const FILE_ENCRYPTION_FORMAT = 'aes-gcm-chunked-v1-or-aad-v2';

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
    updatedAt?: number;
};

type UploadStorageIndex = {
    metaKey: string;
    activeKey: string;
    uploadId: string;
};

type ActiveUploadCandidate = {
    uploadId: string;
    meta: UploadMeta;
    createdAt: number;
};

@Injectable()
export class FilesService implements OnModuleInit {
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

    onModuleInit() {
        // Storage maintenance must never delay API startup. It handles and logs
        // its own errors and is also repeated by the scheduler/storage engine.
        void this.cleanupStaleMultipartUploads();
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
        const initLockToken = await this.acquireUploadInitLock(userId);

        try {
            const s3Init = await this.s3.send(new CreateMultipartUploadCommand({
                Bucket: this.bucket,
                Key: storageKey,
            }));
            s3UploadId = s3Init.UploadId;
            if (!s3UploadId) {
                throw new InternalServerErrorException('Storage did not create a multipart upload');
            }

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
                    updatedAt: Date.now(),
                } satisfies UploadMeta),
                'EX', UPLOAD_META_TTL_SECONDS
            );
            uploadMetaCreated = true;

            await this.setUploadStorageIndex(s3UploadId, {
                metaKey,
                activeKey: this.getActiveUploadKey(userId),
                uploadId,
            });

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

            if (s3UploadId) {
                await this.redis.del(this.getUploadStorageIndexKey(s3UploadId));
            }

            if (uploadReserved) {
                await this.releaseActiveUpload(userId, uploadId);
            }

            throw error;
        } finally {
            await this.releaseUploadInitLock(userId, initLockToken).catch((error) => {
                this.logger.warn(`Failed to release upload init lock: ${this.getErrorMessage(error)}`);
            });
        }
    }

    async handleChunk(userId: string, uploadId: string, file: Express.Multer.File, chunkIndex: number) {
        if (!file || !file.buffer) throw new BadRequestException('File data is missing');

        const metaKey = this.getUploadMetaKey(userId, uploadId);
        const metaStr = await this.redis.get(metaKey);

        if (!metaStr) throw new BadRequestException('Invalid or expired Upload ID');

        const meta = JSON.parse(metaStr) as UploadMeta;
        if (!meta.s3UploadId) throw new BadRequestException('Invalid Upload ID');

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

        meta.updatedAt = Date.now();
        await this.refreshUploadState(userId, uploadId, meta);

        const uploadResult = await this.s3.send(new UploadPartCommand({
            Bucket: this.bucket,
            Key: meta.storageKey,
            UploadId: meta.s3UploadId,
            PartNumber: partNumber,
            Body: file.buffer,
        }));

        // A page-exit cancellation can race with an UploadPart request already in
        // flight. If cancellation removed the state while S3 was accepting this
        // part, abort once more so the late part cannot become an orphan.
        if (!(await this.redis.exists(metaKey))) {
            await this.abortMultipartUpload(meta.storageKey, meta.s3UploadId).catch(() => {});
            throw new BadRequestException('Upload was cancelled');
        }

        meta.parts.push({ PartNumber: partNumber, ETag: uploadResult.ETag });
        meta.nextExpectedChunk++;
        meta.updatedAt = Date.now();

        await this.refreshUploadState(userId, uploadId, meta);

        return { message: `Chunk ${chunkIndex} accepted` };
    }

    async finalizeUpload(userId: string, uploadId: string, fileName: string, mimetype: string, fileKeyFromFrontend: string, totalChunks: number) {
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
        if (totalChunks !== meta.totalChunks) {
            throw new BadRequestException('Chunk count does not match initialized upload');
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

            const completedObject = await this.s3.send(new HeadObjectCommand({
                Bucket: this.bucket,
                Key: meta.storageKey,
            }));
            const expectedEncryptedSize = this.getExpectedEncryptedSize(meta.fileSize);
            if (completedObject.ContentLength !== expectedEncryptedSize) {
                throw new InternalServerErrorException('Stored file size validation failed');
            }

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
            if (meta.s3UploadId) {
                await this.redis.del(this.getUploadStorageIndexKey(meta.s3UploadId));
            }
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
            if (meta.s3UploadId) {
                await this.redis.del(this.getUploadStorageIndexKey(meta.s3UploadId));
            }
            await this.releaseActiveUpload(userId, uploadId);
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                throw error;
            }
            throw new InternalServerErrorException('Finalize failed');
        }
    }

    async getDownloadMetadata(
        fileId: string,
        token: string,
        providedPassword?: string,
        clientIp = 'unknown',
    ) {
        const file = await this.getDownloadableFile(fileId, token);
        await this.assertDownloadPassword(file, providedPassword, clientIp);
        const plaintextSize = Number(file.size);
        const chunkCount = Math.ceil(plaintextSize / PLAINTEXT_CHUNK_SIZE_BYTES);

        return {
            fileName: file.originalName,
            mimeType: file.mimetype,
            plaintextSize,
            encryptedSize: this.getExpectedEncryptedSize(plaintextSize),
            chunkSize: PLAINTEXT_CHUNK_SIZE_BYTES,
            chunkCount,
            encryptionOverhead: ENCRYPTED_CHUNK_OVERHEAD_BYTES,
            format: FILE_ENCRYPTION_FORMAT,
            passwordProtected: Boolean(file.passwordHash),
        };
    }

    async downloadFile(fileId: string, token: string, providedPassword?: string, clientIp = 'unknown') {
        const file = await this.getDownloadableFile(fileId, token);
        await this.assertDownloadPassword(file, providedPassword, clientIp);

        const s3Response = await this.s3.send(new GetObjectCommand({
            Bucket: this.bucket,
            Key: file.storageName,
        }));

        if (!s3Response.Body) throw new InternalServerErrorException('File not found in storage');

        const stream = s3Response.Body as Readable;
        const plaintextSize = Number(file.size);
        const chunkCount = Math.ceil(plaintextSize / PLAINTEXT_CHUNK_SIZE_BYTES);
        const encryptedSize = this.getExpectedEncryptedSize(plaintextSize);
        if (s3Response.ContentLength !== encryptedSize) {
            stream.destroy();
            this.logger.error(
                `Stored size mismatch for file ${file.id}: expected ${encryptedSize}, got ${s3Response.ContentLength ?? 'unknown'}`,
            );
            throw new InternalServerErrorException('Stored file size validation failed');
        }

        return {
            stream,
            fileName: file.originalName,
            mimeType: file.mimetype,
            plaintextSize,
            encryptedSize,
            chunkSize: PLAINTEXT_CHUNK_SIZE_BYTES,
            chunkCount,
            encryptionOverhead: ENCRYPTED_CHUNK_OVERHEAD_BYTES,
            format: FILE_ENCRYPTION_FORMAT,
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

    @Cron('*/10 * * * *')
    async cleanupStaleMultipartUploads() {
        const cutoff = Date.now() - INCOMPLETE_UPLOAD_STALE_MS;
        let keyMarker: string | undefined;
        let uploadIdMarker: string | undefined;
        let abortedCount = 0;

        try {
            while (true) {
                const page = await this.s3.send(new ListMultipartUploadsCommand({
                    Bucket: this.bucket,
                    KeyMarker: keyMarker,
                    UploadIdMarker: uploadIdMarker,
                }));

                for (const upload of page.Uploads ?? []) {
                    if (!upload.Key || !upload.UploadId) continue;

                    try {
                        const lastActivity = await this.getMultipartLastActivity(upload.Key, upload.UploadId, upload.Initiated);
                        if (lastActivity > cutoff) continue;

                        await this.abortMultipartUpload(upload.Key, upload.UploadId);
                        await this.removeTrackedUploadState(upload.UploadId);
                        abortedCount++;
                        this.logger.warn(`Aborted stale multipart upload ${upload.UploadId} for ${upload.Key}`);
                    } catch (error) {
                        this.logger.warn(
                            `Failed to inspect or abort multipart upload ${upload.UploadId}: ${this.getErrorMessage(error)}`,
                        );
                    }
                }

                if (!page.IsTruncated) break;
                if (!page.NextKeyMarker) {
                    this.logger.warn('Stopped multipart cleanup because storage returned no continuation marker');
                    break;
                }
                keyMarker = page.NextKeyMarker;
                uploadIdMarker = page.NextUploadIdMarker;
            }

            if (abortedCount > 0) {
                this.logger.log(`Removed ${abortedCount} stale multipart upload(s)`);
            }
        } catch (error) {
            this.logger.error(`Multipart cleanup failed: ${this.getErrorMessage(error)}`);
        }
    }

    async cancelUpload(userId: string, uploadId: string) {
        const metaKey = this.getUploadMetaKey(userId, uploadId);
        const metaStr = await this.redis.get(metaKey);

        if (!metaStr) {
            await this.releaseActiveUpload(userId, uploadId);
            return;
        }

        let meta: UploadMeta;
        try {
            meta = JSON.parse(metaStr) as UploadMeta;
        } catch {
            await this.redis.del(metaKey);
            await this.releaseActiveUpload(userId, uploadId);
            return;
        }

        if (meta.storageKey && meta.s3UploadId) {
            await this.abortMultipartUpload(meta.storageKey, meta.s3UploadId);
            await this.redis.del(this.getUploadStorageIndexKey(meta.s3UploadId));
        }

        await this.redis.del(metaKey);
        await this.releaseActiveUpload(userId, uploadId);
        this.logger.log(`Cancelled multipart upload ${uploadId} for user ${userId}`);
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

    private getUploadStorageIndexKey(s3UploadId: string) {
        return `upload:s3:${s3UploadId}`;
    }

    private async setUploadStorageIndex(s3UploadId: string, index: UploadStorageIndex) {
        await this.redis.set(
            this.getUploadStorageIndexKey(s3UploadId),
            JSON.stringify(index),
            'EX',
            UPLOAD_META_TTL_SECONDS,
        );
    }

    private async refreshUploadState(userId: string, uploadId: string, meta: UploadMeta) {
        const transaction = this.redis.multi();
        transaction.set(this.getUploadMetaKey(userId, uploadId), JSON.stringify(meta), 'EX', UPLOAD_META_TTL_SECONDS);
        transaction.expire(this.getActiveUploadKey(userId), UPLOAD_META_TTL_SECONDS);
        if (meta.s3UploadId) {
            transaction.expire(this.getUploadStorageIndexKey(meta.s3UploadId), UPLOAD_META_TTL_SECONDS);
        }
        await transaction.exec();
    }

    private getExpectedEncryptedSize(plaintextSize: number) {
        if (!Number.isSafeInteger(plaintextSize) || plaintextSize < 1 || plaintextSize > ADMIN_MAX_FILE_SIZE_BYTES) {
            throw new InternalServerErrorException('Invalid stored file size');
        }

        const chunkCount = Math.ceil(plaintextSize / PLAINTEXT_CHUNK_SIZE_BYTES);
        return plaintextSize + (chunkCount * ENCRYPTED_CHUNK_OVERHEAD_BYTES);
    }

    private async getDownloadableFile(fileId: string, token: string) {
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });

        if (!file || file.shareToken !== token) {
            throw new NotFoundException('File not found or invalid token');
        }

        if (new Date() > file.expiresAt) {
            await this.deleteFileInternal(file.id);
            throw new NotFoundException('File has expired');
        }

        return file;
    }

    private async assertDownloadPassword(
        file: { id: string; passwordHash: string | null },
        providedPassword: string | undefined,
        clientIp: string,
    ) {
        if (!file.passwordHash) return;
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
            await this.abortMultipartUpload(candidate.meta.storageKey, candidate.meta.s3UploadId);
            await this.redis.del(this.getUploadStorageIndexKey(candidate.meta.s3UploadId));
        }

        await this.redis.del(this.getUploadMetaKey(userId, candidate.uploadId));
        await this.releaseActiveUpload(userId, candidate.uploadId);
        this.logger.log(`Replaced active upload ${candidate.uploadId} for user ${userId}`);
    }

    private async acquireUploadInitLock(userId: string) {
        const token = uuidv4();
        const acquired = await this.redis.set(
            `upload:init-lock:${userId}`,
            token,
            'EX',
            UPLOAD_INIT_LOCK_TTL_SECONDS,
            'NX',
        );

        if (acquired !== 'OK') {
            throw new ConflictException('Another upload is currently being initialized');
        }

        return token;
    }

    private async releaseUploadInitLock(userId: string, token: string) {
        await this.redis.eval(
            `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`,
            1,
            `upload:init-lock:${userId}`,
            token,
        );
    }

    private async getMultipartLastActivity(key: string, uploadId: string, initiated?: Date) {
        const trackedState = await this.redis.get(this.getUploadStorageIndexKey(uploadId));
        if (trackedState) {
            try {
                const index = JSON.parse(trackedState) as UploadStorageIndex;
                const metaStr = await this.redis.get(index.metaKey);
                if (metaStr) {
                    const meta = JSON.parse(metaStr) as UploadMeta;
                    const updatedAt = Number(meta.updatedAt ?? meta.createdAt);
                    if (Number.isFinite(updatedAt)) return updatedAt;
                }
            } catch {
                // Fall back to storage timestamps when Redis state is malformed.
            }
        }

        let latest = initiated?.getTime() ?? 0;
        let partNumberMarker: string | undefined;

        do {
            const page = await this.s3.send(new ListPartsCommand({
                Bucket: this.bucket,
                Key: key,
                UploadId: uploadId,
                PartNumberMarker: partNumberMarker,
            }));

            for (const part of page.Parts ?? []) {
                latest = Math.max(latest, part.LastModified?.getTime() ?? 0);
            }

            partNumberMarker = page.IsTruncated ? page.NextPartNumberMarker : undefined;
        } while (partNumberMarker);

        return latest;
    }

    private async abortMultipartUpload(key: string, uploadId: string) {
        await this.s3.send(new AbortMultipartUploadCommand({
            Bucket: this.bucket,
            Key: key,
            UploadId: uploadId,
        }));
    }

    private async removeTrackedUploadState(s3UploadId: string) {
        const indexKey = this.getUploadStorageIndexKey(s3UploadId);
        const indexStr = await this.redis.get(indexKey);
        if (!indexStr) return;

        try {
            const index = JSON.parse(indexStr) as UploadStorageIndex;
            await this.redis.multi()
                .del(index.metaKey)
                .srem(index.activeKey, index.uploadId)
                .del(indexKey)
                .exec();
        } catch {
            await this.redis.del(indexKey);
        }
    }

    private getErrorMessage(error: unknown) {
        return error instanceof Error ? error.message : String(error);
    }

    private async getMasterKeyForUser(userId: string) {
        const masterKeyHex = await this.redis.get(`masterkey:${userId}`);
        if (!masterKeyHex) throw new UnauthorizedException('Session expired');

        return Buffer.from(masterKeyHex, 'hex');
    }
}

export const storageConfig = {
    limits: {
        // Busboy treats this limit as exclusive; +1 allows the exact valid
        // frame size while handleChunk still rejects every larger payload.
        fileSize: PLAINTEXT_CHUNK_SIZE_BYTES + ENCRYPTED_CHUNK_OVERHEAD_BYTES + 1,
    },
    storage: memoryStorage(),
};
