import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuditActorType,
  Prisma,
  UserAvatar,
  UserRestrictionType,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { addDays } from 'date-fns';
import {
  AdminUsersQueryDto,
  ChangeAdminUsernameDto,
  DeleteAdminUserFilesDto,
  ForceLogoutAdminUserDto,
  UpdateAdminUserStatusDto,
} from 'src/admin/dto/users.dto';
import { AuditLogsQueryDto } from 'src/admin/dto/audit.dto';

type MinimalAdminUser = {
  id: string;
  username: string;
  avatar: UserAvatar;
  createdAt: Date;
  status: UserStatus;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly fileS3: S3Client;
  private readonly mailS3: S3Client;
  private readonly filesBucket = process.env.S3_BUCKET_FILES || 'redbox-files';
  private readonly mailsBucket = process.env.S3_BUCKET_MAILS || 'redbox-mails';

  constructor(
    private readonly prismaService: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    const s3Config = {
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'admin_redbox',
        secretAccessKey: process.env.S3_SECRET_KEY || 'SuperSecretMinioPassword123',
      },
      forcePathStyle: true,
    };

    this.fileS3 = new S3Client(s3Config);
    this.mailS3 = new S3Client(s3Config);
  }

  async getProfile(userId: string) {
    return this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        avatar: true,
        createdAt: true,
        issuedCodes: true,
        status: true,
      },
    });
  }

  async updateAvatar(userId: string, avatar: UserAvatar) {
    return this.prismaService.user.update({
      where: { id: userId },
      data: { avatar },
      select: { avatar: true },
    });
  }

  async generateInviteCode(userId: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        issuedCodes: true,
        status: true,
      },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Only active users can generate invite codes');
    }

    if (user.issuedCodes >= 2) {
      throw new BadRequestException('Invite-Limit reached');
    }

    const newCodeString = `RB-${randomBytes(8).toString('hex').toUpperCase()}`;

    return this.prismaService.$transaction(async (prisma) => {
      const newInvite = await prisma.inviteCode.create({
        data: {
          code: newCodeString,
          usage: 1,
          isValid: true,
          userId,
        } as Prisma.InviteCodeUncheckedCreateInput,
      });

      await prisma.user.update({
        where: { id: userId },
        data: { issuedCodes: { increment: 1 } },
      });

      return newInvite;
    });
  }

  async getMyInvites(userId: string) {
    return this.prismaService.inviteCode.findMany({
      where: { userId } as Prisma.InviteCodeWhereInput,
      select: {
        code: true,
        usage: true,
        isValid: true,
      },
      orderBy: { code: 'asc' },
    });
  }

  async requestAccountDeletion(userId: string, password: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        status: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid password');
    }

    if (user.status === UserStatus.DELETED) {
      throw new BadRequestException('This account has already been deleted');
    }

    const activeRequest = await this.getActiveDeletionRequest(userId);
    if (activeRequest) {
      throw new BadRequestException('Account deletion has already been requested');
    }

    const deleteAfterAt = addDays(new Date(), 7);

    await this.prismaService.$transaction(async (prisma) => {
      await prisma.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.PENDING,
          sessionKey: randomUUID(),
        },
      });

      await prisma.userDeletionRequest.create({
        data: {
          userId,
          deleteAfterAt,
        },
      });

      await this.createAuditLog(prisma, {
        actorType: AuditActorType.USER,
        targetUserId: userId,
        action: 'user_delete_requested',
        previousStatus: user.status,
        newStatus: UserStatus.PENDING,
      });
    });

    await this.redis.del(`masterkey:${userId}`);

    return {
      success: true,
      status: 'pending',
      deleteAfterAt: deleteAfterAt.toISOString(),
    };
  }

  async cancelAccountDeletion(userId: string, password: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        status: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid password');
    }

    const activeRequest = await this.getActiveDeletionRequest(userId);
    if (!activeRequest) {
      throw new BadRequestException('No active deletion request found');
    }

    await this.prismaService.$transaction(async (prisma) => {
      await prisma.userDeletionRequest.update({
        where: { id: activeRequest.id },
        data: { cancelledAt: new Date() },
      });

      await prisma.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.ACTIVE,
          sessionKey: randomUUID(),
        },
      });

      await this.createAuditLog(prisma, {
        actorType: AuditActorType.USER,
        targetUserId: userId,
        action: 'user_delete_cancelled',
        previousStatus: user.status,
        newStatus: UserStatus.ACTIVE,
      });
    });

    await this.redis.del(`masterkey:${userId}`);

    return {
      success: true,
      status: 'active',
    };
  }

  async assertUserCanLogin(user: {
    id: string;
    username: string;
    status: UserStatus;
  }) {
    if (user.status === UserStatus.ACTIVE) {
      return;
    }

    if (user.status === UserStatus.DELETED) {
      throw new ForbiddenException('This account has been deleted.');
    }

    if (user.status === UserStatus.PENDING) {
      const request = await this.getActiveDeletionRequest(user.id);
      if (request && request.deleteAfterAt <= new Date()) {
        await this.finalizePendingDeletion(user.id, request.id);
        throw new ForbiddenException('This account has been deleted.');
      }

      if (!request) {
        await this.reactivateUser(user.id, {
          actorType: AuditActorType.SYSTEM,
          reason: 'Pending deletion request missing during login check',
          action: 'user_status_normalized',
        });
        return;
      }

      throw new ForbiddenException(
        `This account is pending deletion and will be deleted on ${request.deleteAfterAt.toISOString()}.`,
      );
    }

    if (user.status === UserStatus.LOCKED) {
      const restriction = await this.getActiveRestriction(user.id, UserRestrictionType.LOCK);
      const reason = restriction?.reason ?? 'administrative action';
      throw new ForbiddenException(`This user has been locked due to ${reason}.`);
    }

    if (user.status === UserStatus.BANNED) {
      const restriction = await this.getActiveRestriction(user.id, UserRestrictionType.BAN);

      if (
        restriction &&
        !restriction.isPermanent &&
        restriction.expiresAt &&
        restriction.expiresAt <= new Date()
      ) {
        await this.reactivateUser(user.id, {
          actorType: AuditActorType.SYSTEM,
          reason: 'Temporary ban expired',
          action: 'user_status_auto_reactivated',
        });
        return;
      }

      const reason = restriction?.reason ?? 'administrative action';
      if (restriction?.isPermanent) {
        throw new ForbiddenException(`This user has been permanently banned due to ${reason}.`);
      }

      if (restriction?.expiresAt) {
        throw new ForbiddenException(
          `This user has been banned until ${restriction.expiresAt.toISOString()} due to ${reason}.`,
        );
      }

      throw new ForbiddenException(`This user has been banned due to ${reason}.`);
    }
  }

  async getAdminUsersStats() {
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

  async getAdminUserCountSummary() {
    const stats = await this.getAdminUsersStats();
    return {
      totalUsers: stats.totalUsers,
      newToday: stats.newLast1d,
      newLast7Days: stats.newLast7d,
      newLast30Days: stats.newLast30d,
    };
  }

  async getAdminUsers(query: AdminUsersQueryDto) {
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

  async getAdminUserById(userId: string) {
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

  async updateUserStatusByAdmin(adminUserId: string, userId: string, dto: UpdateAdminUserStatusDto) {
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

    const updatedUser = await this.getAdminUserById(userId);

    return {
      success: true,
      message: 'User status updated successfully',
      user: updatedUser,
    };
  }

  async forceLogoutUserByAdmin(adminUserId: string, userId: string, dto: ForceLogoutAdminUserDto) {
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

  async changeUsernameByAdmin(adminUserId: string, userId: string, dto: ChangeAdminUsernameDto) {
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

  async deleteUserFilesByAdmin(adminUserId: string, userId: string, dto: DeleteAdminUserFilesDto) {
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

  async getAdminAuditLogs(query: AuditLogsQueryDto) {
    const where: Prisma.AdminAuditLogWhereInput = {};

    if (query.adminId) {
      where.adminUserId = query.adminId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.targetUserId) {
      where.targetUserId = query.targetUserId;
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const [items, total] = await Promise.all([
      this.prismaService.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prismaService.adminAuditLog.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        actorType: item.actorType.toLowerCase(),
        adminId: item.adminUserId,
        targetUserId: item.targetUserId,
        action: item.action,
        previousStatus: item.previousStatus ? item.previousStatus.toLowerCase() : null,
        newStatus: item.newStatus ? item.newStatus.toLowerCase() : null,
        reason: item.reason,
        meta: item.meta,
        createdAt: item.createdAt.toISOString(),
      })),
      pagination: {
        limit: query.limit,
        offset: query.offset,
        returned: items.length,
        hasMore: query.offset + items.length < total,
        total,
      },
    };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async processPendingDeletionRequests() {
    const requests = await this.prismaService.userDeletionRequest.findMany({
      where: {
        cancelledAt: null,
        processedAt: null,
        deleteAfterAt: { lte: new Date() },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    for (const request of requests) {
        await this.finalizePendingDeletion(request.userId, request.id);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async processExpiredRestrictions() {
    const expiredBans = await this.prismaService.userRestriction.findMany({
      where: {
        type: UserRestrictionType.BAN,
        resolvedAt: null,
        isPermanent: false,
        expiresAt: { lte: new Date() },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    for (const restriction of expiredBans) {
      await this.reactivateUser(restriction.userId, {
        actorType: AuditActorType.SYSTEM,
        reason: 'Temporary ban expired',
        action: 'user_status_auto_reactivated',
      });
    }
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

  private async getActiveDeletionRequest(userId: string) {
    return this.prismaService.userDeletionRequest.findFirst({
      where: {
        userId,
        cancelledAt: null,
        processedAt: null,
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  private async getActiveRestriction(userId: string, type: UserRestrictionType) {
    return this.prismaService.userRestriction.findFirst({
      where: {
        userId,
        type,
        resolvedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
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
    const [files, mails] = await Promise.all([
      this.prismaService.file.findMany({
        where: { userId },
        select: {
          storageName: true,
        },
      }),
      this.prismaService.mail.findMany({
        where: { userId },
        include: {
          attachments: {
            select: { storageKey: true },
          },
        },
      }),
    ]);

    await this.deleteS3Objects(
      this.fileS3,
      this.filesBucket,
      files.map((file) => file.storageName),
    );

    const mailStorageKeys = mails.flatMap((mail) => [
      mail.storageKey,
      ...mail.attachments.map((attachment) => attachment.storageKey),
    ]);
    await this.deleteS3Objects(this.mailS3, this.mailsBucket, mailStorageKeys);

    await this.prismaService.$transaction(async (prisma) => {
      await prisma.blockedSender.deleteMany({ where: { userId } });
      await prisma.link.deleteMany({ where: { userId } });
      await prisma.bin.deleteMany({ where: { userId } });
      await prisma.mail.deleteMany({ where: { userId } });
      await prisma.file.deleteMany({ where: { userId } });
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
      });
    });

    await this.redis.del(`masterkey:${userId}`);
  }

  private async finalizePendingDeletion(userId: string, deletionRequestId: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
      },
    });

    if (!user || user.status === UserStatus.DELETED) {
      return;
    }

    await this.deleteUserDataAndMarkDeleted(userId, {
      actorType: AuditActorType.SYSTEM,
      action: 'user_deletion_processed',
      previousStatus: user.status,
      deletionRequestId,
    });
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
}
