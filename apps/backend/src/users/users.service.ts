import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditActorType, Prisma, UserAvatar, UserRestrictionType, UserStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { addDays } from 'date-fns';

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

  async preparePendingDeletionLogin(userId: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!user || user.status !== UserStatus.PENDING) {
      return null;
    }

    const activeRequest = await this.getActiveDeletionRequest(userId);
    if (activeRequest && activeRequest.deleteAfterAt <= new Date()) {
      await this.finalizePendingDeletion(userId, activeRequest.id);
      throw new ForbiddenException('This account has been deleted.');
    }

    if (!activeRequest) {
      await this.reactivateUser(user.id, {
        actorType: AuditActorType.SYSTEM,
        reason: 'Pending deletion request missing during login check',
        action: 'user_status_normalized',
      });
      return null;
    }

    return activeRequest;
  }

  async reactivatePendingAccount(userId: string, deletionRequestId: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status === UserStatus.DELETED) {
      throw new BadRequestException('This account has already been deleted');
    }

    if (user.status === UserStatus.ACTIVE) {
      return {
        success: true,
        status: 'active',
      };
    }

    if (user.status !== UserStatus.PENDING) {
      throw new BadRequestException('No active deletion request found');
    }

    const activeRequest = await this.getActiveDeletionRequest(userId);
    if (!activeRequest || activeRequest.id !== deletionRequestId) {
      throw new BadRequestException('No active deletion request found');
    }

    if (activeRequest.deleteAfterAt <= new Date()) {
      await this.finalizePendingDeletion(userId, activeRequest.id);
      throw new ForbiddenException('This account has been deleted.');
    }

    await this.reactivateUser(userId, {
      actorType: AuditActorType.USER,
      action: 'user_delete_cancelled',
    });

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
      const pendingRequest = await this.preparePendingDeletionLogin(user.id);
      if (!pendingRequest) {
        return;
      }

      throw new ForbiddenException(
        `This account is pending deletion and will be deleted on ${pendingRequest.deleteAfterAt.toISOString()}.`,
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

  private async reactivateUser(
    userId: string,
    options: {
      actorType: AuditActorType;
      action: string;
      reason?: string;
      adminUserId?: string;
    },
  ) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

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
