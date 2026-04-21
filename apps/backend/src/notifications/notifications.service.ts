import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditActorType, Prisma, SystemNotificationCategory } from '@prisma/client';
import { Observable } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  CreateSystemNotificationDto,
  NotificationCategoryApi,
  SystemNotificationsQueryDto,
} from './dto/notifications.dto';
import {
  NotificationEventsService,
  SystemNotificationPayload,
} from './notification-events.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationEventsService: NotificationEventsService,
  ) {}

  async getActiveNotifications() {
    const notifications = await this.prismaService.systemNotification.findMany({
      where: {
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return notifications.map((notification) => this.toPayload(notification));
  }

  streamActiveNotifications(): Observable<MessageEvent> {
    return this.notificationEventsService.stream(() => this.getActiveNotifications());
  }

  async getAdminNotifications(query: SystemNotificationsQueryDto) {
    const where: Prisma.SystemNotificationWhereInput = {};

    if (query.category) {
      where.category = this.toPrismaCategory(query.category);
    }

    if (query.activeOnly ?? false) {
      where.expiresAt = { gt: new Date() };
    }

    const [items, total] = await Promise.all([
      this.prismaService.systemNotification.findMany({
        where,
        include: {
          createdByAdminUser: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prismaService.systemNotification.count({ where }),
    ]);

    return {
      items: items.map((notification) => ({
        ...this.toPayload(notification),
        createdByAdmin: notification.createdByAdminUser
          ? {
              id: notification.createdByAdminUser.id,
              username: notification.createdByAdminUser.username,
            }
          : null,
        isExpired: notification.expiresAt <= new Date(),
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

  async createNotification(adminUserId: string, dto: CreateSystemNotificationDto) {
    const expiresAt = this.resolveExpiresAt(dto);
    const message = dto.message.trim();

    if (!message) {
      throw new BadRequestException("Message can't be empty");
    }

    const notification = await this.prismaService.$transaction(async (prisma) => {
      const createdNotification = await prisma.systemNotification.create({
        data: {
          category: this.toPrismaCategory(dto.category),
          message,
          expiresAt,
          createdByAdminUserId: adminUserId,
        },
      });

      await prisma.adminAuditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          adminUserId,
          action: 'system_notification_created',
          reason: `System notification created (${dto.category})`,
          meta: {
            notificationId: createdNotification.id,
            category: dto.category,
            message,
            expiresAt: expiresAt.toISOString(),
          },
        },
      });

      return createdNotification;
    });

    const payload = this.toPayload(notification);
    await this.notificationEventsService.emitNotificationCreated(payload);

    return {
      success: true,
      message: 'System notification created successfully',
      notification: payload,
    };
  }

  private resolveExpiresAt(dto: CreateSystemNotificationDto) {
    const expiryInputs = [
      dto.expiresAt !== undefined,
      dto.durationSeconds !== undefined,
      dto.durationMinutes !== undefined,
    ].filter(Boolean).length;

    if (expiryInputs !== 1) {
      throw new BadRequestException(
        'Provide exactly one expiry option: expiresAt, durationSeconds or durationMinutes',
      );
    }

    if (dto.expiresAt) {
      const expiresAt = new Date(dto.expiresAt);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        throw new BadRequestException('expiresAt must be in the future');
      }

      return expiresAt;
    }

    const durationMs =
      dto.durationSeconds !== undefined
        ? dto.durationSeconds * 1000
        : dto.durationMinutes! * 60 * 1000;

    return new Date(Date.now() + durationMs);
  }

  private toPayload(notification: {
    id: string;
    category: SystemNotificationCategory;
    message: string;
    createdAt: Date;
    expiresAt: Date;
  }): SystemNotificationPayload {
    const createdAt = notification.createdAt.toISOString();

    return {
      id: notification.id,
      category: this.toApiCategory(notification.category),
      message: notification.message,
      timestamp: createdAt,
      createdAt,
      expiresAt: notification.expiresAt.toISOString(),
    };
  }

  private toPrismaCategory(category: NotificationCategoryApi) {
    if (category === 'warning') {
      return SystemNotificationCategory.WARNING;
    }

    if (category === 'error') {
      return SystemNotificationCategory.ERROR;
    }

    if (category === 'success') {
      return SystemNotificationCategory.SUCCESS;
    }

    if (category === 'maintenance') {
      return SystemNotificationCategory.MAINTENANCE;
    }

    return SystemNotificationCategory.INFO;
  }

  private toApiCategory(category: SystemNotificationCategory): NotificationCategoryApi {
    if (category === SystemNotificationCategory.WARNING) {
      return 'warning';
    }

    if (category === SystemNotificationCategory.ERROR) {
      return 'error';
    }

    if (category === SystemNotificationCategory.SUCCESS) {
      return 'success';
    }

    if (category === SystemNotificationCategory.MAINTENANCE) {
      return 'maintenance';
    }

    return 'info';
  }
}
