import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditActorType,
  Prisma,
  UserAvatar,
  UserRestrictionType,
  UserStatus,
} from '@prisma/client';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { S3Client, AbortMultipartUploadCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { addDays } from 'date-fns';
import { randomUUID } from 'crypto';
import { createRequiredS3Client, requireBucket } from 'src/common/storage/s3-client';
import { PrismaService } from 'src/prisma.service';
import {
  AdminUsersQueryDto,
  ChangeAdminUsernameDto,
  ClearAdminUserDataDto,
  DeleteAdminUserFilesDto,
  ForceLogoutAdminUserDto,
  UpdateAdminUserStatusDto,
} from '../dto/users.dto';

type MinimalAdminUser = {
  id: string;
  username: string;
  avatar: UserAvatar;
  createdAt: Date;
  status: UserStatus;
};

type UserContentDeletionSnapshot = {
  fileStorageNames: string[];
  mailStorageKeys: string[];
};

type UserContentDeletionCounts = {
  deletedUploadsCount: number;
  deletedMailsCount: number;
  deletedBinsCount: number;
  deletedLinksCount: number;
};

type UserRedisCleanupResult = {
  deletedRedisKeysCount: number;
  abortedActiveUploadsCount: number;
};

type UploadMeta = {
  storageKey?: string;
  s3UploadId?: string;
};

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);
  private readonly fileS3: S3Client;
  private readonly mailS3: S3Client;
  private readonly filesBucket = requireBucket('S3_BUCKET_FILES');
  private readonly mailsBucket = requireBucket('S3_BUCKET_MAILS');

  constructor(
    private readonly prismaService: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.fileS3 = createRequiredS3Client();
    this.mailS3 = createRequiredS3Client();
  }

  async getUserCountSummary() {
    const stats = await this.getUsersStats();
    return {
      totalUsers: stats.totalUsers,
      newToday: stats.newLast1d,
      newLast7Days: stats.newLast7d,
      newLast30Days: stats.newLast30d,
    };
  }

  async getUsersStats() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const baseWhere: Prisma.UserWhereInput = {
      status: { not: UserStatus.DELETED },
    };

    const [totalUsers, newLast1d, newLast7d, newLast30d, groupedByStatus] = await Promise.all([
      this.prismaService.user.count({ where: baseWhere }),
      this.prismaService.user.count({
        where: {
          ...baseWhere,
          createdAt: { gte: oneDayAgo },
        },
      }),
      this.prismaService.user.count({
        where: {
          ...baseWhere,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      this.prismaService.user.count({
        where: {
          ...baseWhere,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      this.prismaService.user.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: {
          _all: true,
        },
      }),
    ]);

    const counts = {
      activeUsers: 0,
      lockedUsers: 0,
      bannedUsers: 0,
      pendingUsers: 0,
    };

    for (const group of groupedByStatus) {
      if (group.status === UserStatus.ACTIVE) counts.activeUsers = group._count._all;
      if (group.status === UserStatus.LOCKED) counts.lockedUsers = group._count._all;
      if (group.status === UserStatus.BANNED) counts.bannedUsers = group._count._all;
      if (group.status === UserStatus.PENDING) counts.pendingUsers = group._count._all;
    }

    return {
      totalUsers,
      newLast1d,
      newLast7d,
      newLast30d,
      ...counts,
    };
  }

  async getUsersOverviewStats() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const baseWhere: Prisma.UserWhereInput = {
      status: { not: UserStatus.DELETED },
    };

    const [userStats, newToday, adminActionsLast7Days] = await Promise.all([
      this.getUsersStats(),
      this.prismaService.user.count({
        where: {
          ...baseWhere,
          createdAt: { gte: startOfToday },
        },
      }),
      this.prismaService.adminAuditLog.count({
        where: {
          actorType: AuditActorType.ADMIN,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    return {
      totalUsers: {
        value: userStats.totalUsers,
        newLast7Days: userStats.newLast7d,
      },
      activeBans: {
        value: userStats.bannedUsers,
        lockedUsers: userStats.lockedUsers,
        pendingUsers: userStats.pendingUsers,
      },
      newToday: {
        value: newToday,
      },
      adminActions7d: {
        value: adminActionsLast7Days,
      },
    };
  }

  async getUsers(query: AdminUsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      status: { not: UserStatus.DELETED },
    };

    if (query.search) {
      const searchValue = query.search.trim();
      if (query.searchType === 'id') {
        where.id = { contains: searchValue };
      } else {
        where.username = { contains: searchValue };
      }
    }

    if (query.status) {
      where.status = this.toUserStatus(query.status);
    }

    const orderBy =
      query.sort === 'username'
        ? { username: query.order }
        : { createdAt: query.order };

    const [users, total] = await Promise.all([
      this.prismaService.user.findMany({
        where,
        orderBy,
        take: query.limit,
        skip: query.offset,
        select: {
          id: true,
          username: true,
          avatar: true,
          createdAt: true,
          status: true,
        },
      }),
      this.prismaService.user.count({ where }),
    ]);

    const items = users.map((user) => this.toMinimalAdminUser(user));

    return {
      items,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        returned: items.length,
        hasMore: query.offset + items.length < total,
        total,
      },
    };
  }

  async getUserById(userId: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        avatar: true,
        createdAt: true,
        status: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toMinimalAdminUser(user);
  }

  async updateUserStatus(adminUserId: string, userId: string, dto: UpdateAdminUserStatusDto) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        avatar: true,
        createdAt: true,
        status: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status === UserStatus.DELETED && dto.status !== 'deleted') {
      throw new BadRequestException('Deleted users cannot be reactivated');
    }

    const nextStatus = this.toUserStatus(dto.status);

    if (nextStatus === UserStatus.ACTIVE) {
      await this.reactivateUser(userId, {
        actorType: AuditActorType.ADMIN,
        adminUserId,
        reason: dto.reason || 'Status set to active',
        action: 'user_status_changed',
      });
    } else if (nextStatus === UserStatus.LOCKED) {
      if (!dto.reason) {
        throw new BadRequestException('Reason is required when locking a user');
      }

      await this.prismaService.$transaction(async (prisma) => {
        await this.cancelActiveDeletionRequests(prisma, userId);
        await this.resolveOpenRestrictions(prisma, userId);
        await prisma.user.update({
          where: { id: userId },
          data: { status: UserStatus.LOCKED, sessionKey: randomUUID() },
        });
        await prisma.userRestriction.create({
          data: {
            userId,
            type: UserRestrictionType.LOCK,
            reason: dto.reason,
            createdByAdminUserId: adminUserId,
          },
        });
        await this.setInviteCodesValidity(prisma, userId, false);
        await this.createAuditLog(prisma, {
          actorType: AuditActorType.ADMIN,
          adminUserId,
          targetUserId: userId,
          action: 'user_status_changed',
          previousStatus: user.status,
          newStatus: UserStatus.LOCKED,
          reason: dto.reason,
          meta: {},
        });
      });

      await this.redis.del(`masterkey:${userId}`);
    } else if (nextStatus === UserStatus.BANNED) {
      if (!dto.reason) {
        throw new BadRequestException('Reason is required when banning a user');
      }

      if (!dto.permanent && !dto.durationDays) {
        throw new BadRequestException('Duration days are required for temporary bans');
      }

      const expiresAt =
        dto.permanent || !dto.durationDays ? null : addDays(new Date(), dto.durationDays);

      await this.prismaService.$transaction(async (prisma) => {
        await this.cancelActiveDeletionRequests(prisma, userId);
        await this.resolveOpenRestrictions(prisma, userId);
        await prisma.user.update({
          where: { id: userId },
          data: { status: UserStatus.BANNED, sessionKey: randomUUID() },
        });
        await prisma.userRestriction.create({
          data: {
            userId,
            type: UserRestrictionType.BAN,
            reason: dto.reason,
            isPermanent: dto.permanent ?? false,
            expiresAt,
            createdByAdminUserId: adminUserId,
          },
        });
        await this.setInviteCodesValidity(prisma, userId, false);
        await this.createAuditLog(prisma, {
          actorType: AuditActorType.ADMIN,
          adminUserId,
          targetUserId: userId,
          action: 'user_status_changed',
          previousStatus: user.status,
          newStatus: UserStatus.BANNED,
          reason: dto.reason,
          meta: {
            permanent: dto.permanent ?? false,
            durationDays: dto.durationDays ?? null,
            expiresAt: expiresAt?.toISOString() ?? null,
          },
        });
      });

      await this.redis.del(`masterkey:${userId}`);
    } else if (nextStatus === UserStatus.DELETED) {
      if (!dto.reason) {
        throw new BadRequestException('Reason is required when deleting a user');
      }

      await this.deleteUserDataAndMarkDeleted(userId, {
        actorType: AuditActorType.ADMIN,
        adminUserId,
        reason: dto.reason,
        action: 'user_status_changed',
        previousStatus: user.status,
      });
    }

    const updatedUser = await this.getUserById(userId);

    return {
      success: true,
      message: 'User status updated successfully',
      user: updatedUser,
    };
  }

  async forceLogoutUser(adminUserId: string, userId: string, dto: ForceLogoutAdminUserDto) {
    const user = await this.findUserOrThrow(userId);

    await this.rotateUserSession(userId);

    await this.prismaService.$transaction(async (prisma) => {
      await this.createAuditLog(prisma, {
        actorType: AuditActorType.ADMIN,
        adminUserId,
        targetUserId: userId,
        action: 'user_force_logout',
        previousStatus: user.status,
        newStatus: user.status,
        reason: dto.reason,
      });
    });

    return {
      success: true,
      message: 'User logged out from all sessions',
      user: this.toMinimalAdminUser(user),
    };
  }

  async changeUsername(adminUserId: string, userId: string, dto: ChangeAdminUsernameDto) {
    const user = await this.findUserOrThrow(userId);

    try {
      const updatedUser = await this.prismaService.$transaction(async (prisma) => {
        const nextUser = await prisma.user.update({
          where: { id: userId },
          data: {
            username: dto.newUsername,
            sessionKey: randomUUID(),
          },
          select: {
            id: true,
            username: true,
            avatar: true,
            createdAt: true,
            status: true,
          },
        });

        await this.createAuditLog(prisma, {
          actorType: AuditActorType.ADMIN,
          adminUserId,
          targetUserId: userId,
          action: 'user_username_changed',
          previousStatus: user.status,
          newStatus: nextUser.status,
          reason: dto.reason,
          meta: {
            previousUsername: user.username,
            newUsername: dto.newUsername,
          },
        });

        return nextUser;
      });

      await this.redis.del(`masterkey:${userId}`);

      return {
        success: true,
        message: 'Username changed successfully',
        user: this.toMinimalAdminUser(updatedUser),
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002') {
        throw new ConflictException('Username already taken');
      }

      throw error;
    }
  }

  async deleteUserFiles(adminUserId: string, userId: string, dto: DeleteAdminUserFilesDto) {
    await this.findUserOrThrow(userId);

    const files = await this.prismaService.file.findMany({
      where: {
        id: { in: dto.fileIds },
        userId,
      },
      select: {
        id: true,
        storageName: true,
      },
    });

    if (files.length === 0) {
      return {
        success: true,
        userId,
        deletedCount: 0,
        deletedFileIds: [],
      };
    }

    await this.deleteS3Objects(
      this.fileS3,
      this.filesBucket,
      files.map((file) => file.storageName),
    );

    const deletedIds = files.map((file) => file.id);

    await this.prismaService.$transaction(async (prisma) => {
      await prisma.file.deleteMany({
        where: {
          id: { in: deletedIds },
          userId,
        },
      });

      await this.createAuditLog(prisma, {
        actorType: AuditActorType.ADMIN,
        adminUserId,
        targetUserId: userId,
        action: 'user_files_deleted',
        reason: dto.reason,
        meta: {
          fileIds: deletedIds,
        },
      });
    });

    return {
      success: true,
      userId,
      deletedCount: deletedIds.length,
      deletedFileIds: deletedIds,
    };
  }

  async clearUserData(adminUserId: string, userId: string, dto: ClearAdminUserDataDto) {
    await this.findUserOrThrow(userId);

    const snapshot = await this.buildUserContentDeletionSnapshot(userId);

    await Promise.all([
      this.deleteS3Objects(this.fileS3, this.filesBucket, snapshot.fileStorageNames),
      this.deleteS3Objects(this.mailS3, this.mailsBucket, snapshot.mailStorageKeys),
    ]);

    const deletedCounts = await this.prismaService.$transaction(async (prisma) => {
      const counts = await this.clearUserContentRecords(prisma, userId);

      await this.createAuditLog(prisma, {
        actorType: AuditActorType.ADMIN,
        adminUserId,
        targetUserId: userId,
        action: 'user_data_cleared',
        reason: dto.reason,
        meta: counts,
      });

      return counts;
    });
    const redisCleanup = await this.clearUserRedisData(userId);

    return {
      success: true,
      userId,
      ...deletedCounts,
      ...redisCleanup,
    };
  }

  private async findUserOrThrow(userId: string): Promise<MinimalAdminUser> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        avatar: true,
        createdAt: true,
        status: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private toUserStatus(value: 'active' | 'locked' | 'banned' | 'pending' | 'deleted') {
    return value.toUpperCase() as UserStatus;
  }

  private toPublicStatus(status: UserStatus) {
    return status.toLowerCase();
  }

  private toMinimalAdminUser(user: MinimalAdminUser) {
    return {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      accountCreationDate: user.createdAt.toISOString(),
      status: this.toPublicStatus(user.status),
    };
  }

  private async setInviteCodesValidity(
    prisma: Prisma.TransactionClient,
    userId: string,
    isValid: boolean,
  ) {
    await prisma.inviteCode.updateMany({
      where: {
        userId,
        usage: { gt: 0 },
      },
      data: {
        isValid,
      },
    });
  }

  private async resolveOpenRestrictions(prisma: Prisma.TransactionClient, userId: string) {
    await prisma.userRestriction.updateMany({
      where: {
        userId,
        resolvedAt: null,
      },
      data: {
        resolvedAt: new Date(),
      },
    });
  }

  private async cancelActiveDeletionRequests(prisma: Prisma.TransactionClient, userId: string) {
    await prisma.userDeletionRequest.updateMany({
      where: {
        userId,
        cancelledAt: null,
        processedAt: null,
      },
      data: {
        cancelledAt: new Date(),
      },
    });
  }

  private async rotateUserSession(userId: string) {
    await this.prismaService.user.update({
      where: { id: userId },
      data: { sessionKey: randomUUID() },
    });

    await this.redis.del(`masterkey:${userId}`);
  }

  private async reactivateUser(
    userId: string,
    options: {
      actorType: AuditActorType;
      action: string;
      reason?: string;
      adminUserId?: string;
    },
  ) {
    const user = await this.findUserOrThrow(userId);

    if (user.status === UserStatus.DELETED) {
      throw new BadRequestException('Deleted users cannot be reactivated');
    }

    await this.prismaService.$transaction(async (prisma) => {
      await this.resolveOpenRestrictions(prisma, userId);
      await this.cancelActiveDeletionRequests(prisma, userId);
      await prisma.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.ACTIVE,
          sessionKey: randomUUID(),
        },
      });
      await this.setInviteCodesValidity(prisma, userId, true);
      await this.createAuditLog(prisma, {
        actorType: options.actorType,
        adminUserId: options.adminUserId,
        targetUserId: userId,
        action: options.action,
        previousStatus: user.status,
        newStatus: UserStatus.ACTIVE,
        reason: options.reason,
      });
    });

    await this.redis.del(`masterkey:${userId}`);
  }

  private async createAuditLog(
    prisma: Prisma.TransactionClient,
    params: {
      actorType: AuditActorType;
      action: string;
      targetUserId?: string;
      adminUserId?: string;
      previousStatus?: UserStatus;
      newStatus?: UserStatus;
      reason?: string;
      meta?: Prisma.InputJsonValue;
    },
  ) {
    await prisma.adminAuditLog.create({
      data: {
        actorType: params.actorType,
        adminUserId: params.adminUserId ?? null,
        targetUserId: params.targetUserId ?? null,
        action: params.action,
        previousStatus: params.previousStatus,
        newStatus: params.newStatus,
        reason: params.reason,
        meta: params.meta ?? undefined,
      },
    });
  }

  private async deleteUserDataAndMarkDeleted(
    userId: string,
    options: {
      actorType: AuditActorType;
      action: string;
      reason?: string;
      previousStatus: UserStatus;
      adminUserId?: string;
      deletionRequestId?: string;
    },
  ) {
    const snapshot = await this.buildUserContentDeletionSnapshot(userId);

    await Promise.all([
      this.deleteS3Objects(this.fileS3, this.filesBucket, snapshot.fileStorageNames),
      this.deleteS3Objects(this.mailS3, this.mailsBucket, snapshot.mailStorageKeys),
    ]);

    await this.prismaService.$transaction(async (prisma) => {
      const clearedData = await this.clearUserContentRecords(prisma, userId);

      await prisma.blockedSender.deleteMany({ where: { userId } });
      await prisma.inviteCode.deleteMany({ where: { userId } });
      await this.resolveOpenRestrictions(prisma, userId);

      if (options.deletionRequestId) {
        await prisma.userDeletionRequest.update({
          where: { id: options.deletionRequestId },
          data: { processedAt: new Date() },
        });
      } else {
        await this.cancelActiveDeletionRequests(prisma, userId);
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.DELETED,
          issuedCodes: 0,
          sessionKey: randomUUID(),
        },
      });

      await this.createAuditLog(prisma, {
        actorType: options.actorType,
        adminUserId: options.adminUserId,
        targetUserId: userId,
        action: options.action,
        previousStatus: options.previousStatus,
        newStatus: UserStatus.DELETED,
        reason: options.reason,
        meta: clearedData,
      });
    });

    await this.clearUserRedisData(userId);
  }

  private async buildUserContentDeletionSnapshot(userId: string): Promise<UserContentDeletionSnapshot> {
    const [files, mails] = await Promise.all([
      this.prismaService.file.findMany({
        where: { userId },
        select: {
          storageName: true,
        },
      }),
      this.prismaService.mail.findMany({
        where: { userId },
        select: {
          storageKey: true,
          attachments: {
            select: { storageKey: true },
          },
        },
      }),
    ]);

    return {
      fileStorageNames: files.map((file) => file.storageName),
      mailStorageKeys: mails.flatMap((mail) => [
        mail.storageKey,
        ...mail.attachments.map((attachment) => attachment.storageKey),
      ]),
    };
  }

  private async clearUserContentRecords(
    prisma: Prisma.TransactionClient,
    userId: string,
  ): Promise<UserContentDeletionCounts> {
    const [deletedLinks, deletedBins, deletedMails, deletedFiles] = await Promise.all([
      prisma.link.deleteMany({ where: { userId } }),
      prisma.bin.deleteMany({ where: { userId } }),
      prisma.mail.deleteMany({ where: { userId } }),
      prisma.file.deleteMany({ where: { userId } }),
    ]);

    return {
      deletedUploadsCount: deletedFiles.count,
      deletedMailsCount: deletedMails.count,
      deletedBinsCount: deletedBins.count,
      deletedLinksCount: deletedLinks.count,
    };
  }

  private async deleteS3Objects(client: S3Client, bucket: string, keys: string[]) {
    await Promise.all(
      keys
        .filter(Boolean)
        .map((key) =>
          client
            .send(
              new DeleteObjectCommand({
                Bucket: bucket,
                Key: key,
              }),
            )
            .catch((error) => {
              this.logger.warn(`Failed to delete S3 object ${key}: ${String(error)}`);
            }),
        ),
    );
  }

  private async clearUserRedisData(userId: string): Promise<UserRedisCleanupResult> {
    const activeUploadKey = this.getActiveUploadKey(userId);
    const metaKeys = new Set<string>([
      ...(await this.getActiveUploadMetaKeys(userId)),
      ...(await this.scanRedisKeys(this.getUploadMetaPattern(userId))),
    ]);

    const abortedActiveUploadsCount = await this.abortRedisBackedUploads([...metaKeys]);
    const redisKeys = [`masterkey:${userId}`, activeUploadKey, ...metaKeys];
    const deletedRedisKeysCount = await this.deleteRedisKeys(redisKeys);

    return {
      deletedRedisKeysCount,
      abortedActiveUploadsCount,
    };
  }

  private async getActiveUploadMetaKeys(userId: string) {
    const uploadIds = await this.redis.smembers(this.getActiveUploadKey(userId));
    return uploadIds.map((uploadId) => this.getUploadMetaKey(userId, uploadId));
  }

  private async abortRedisBackedUploads(metaKeys: string[]) {
    if (metaKeys.length === 0) {
      return 0;
    }

    const metaValues = await this.redis.mget(...metaKeys);
    let abortedCount = 0;

    await Promise.all(
      metaValues.map(async (metaStr, index) => {
        if (!metaStr) {
          return;
        }

        try {
          const meta = JSON.parse(metaStr) as UploadMeta;
          if (!meta.storageKey || !meta.s3UploadId) {
            return;
          }

          await this.fileS3.send(new AbortMultipartUploadCommand({
            Bucket: this.filesBucket,
            Key: meta.storageKey,
            UploadId: meta.s3UploadId,
          }));
          abortedCount += 1;
        } catch (error) {
          this.logger.warn(`Failed to abort Redis-backed upload ${metaKeys[index]}: ${String(error)}`);
        }
      }),
    );

    return abortedCount;
  }

  private async scanRedisKeys(pattern: string) {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    return keys;
  }

  private async deleteRedisKeys(keys: string[]) {
    const uniqueKeys = [...new Set(keys)];
    if (uniqueKeys.length === 0) {
      return 0;
    }

    return this.redis.del(...uniqueKeys);
  }

  private getActiveUploadKey(userId: string) {
    return `upload:active:${userId}`;
  }

  private getUploadMetaKey(userId: string, uploadId: string) {
    return `upload:meta:${userId}:${uploadId}`;
  }

  private getUploadMetaPattern(userId: string) {
    return `${this.getUploadMetaKey(userId, '')}*`;
  }
}
