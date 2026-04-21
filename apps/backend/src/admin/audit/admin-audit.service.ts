import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { AuditLogsQueryDto } from '../dto/audit.dto';

@Injectable()
export class AdminAuditService {
  constructor(private readonly prismaService: PrismaService) {}

  async getLogs(query: AuditLogsQueryDto) {
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
        select: {
          id: true,
          actorType: true,
          adminUserId: true,
          targetUserId: true,
          action: true,
          previousStatus: true,
          newStatus: true,
          reason: true,
          meta: true,
          createdAt: true,
          targetUser: {
            select: {
              username: true,
            },
          },
          adminUser: {
            select: {
              username: true,
            },
          },
        },
      }),
      this.prismaService.adminAuditLog.count({ where }),
    ]);

    return {
      items: items.map((item) => {
        const actorType = item.actorType.toLowerCase();
        const adminUsername = item.adminUser?.username ?? null;
        const actorUsername =
          item.actorType === 'ADMIN'
            ? adminUsername
            : item.actorType === 'USER'
              ? item.targetUser?.username ?? null
              : null;

        return {
          id: item.id,
          actorType,
          adminId: item.adminUserId,
          adminUsername,
          actorUsername,
          actorLabel: actorUsername ?? actorType,
          targetUserId: item.targetUserId,
          username: item.targetUser?.username ?? null,
          action: item.action,
          previousStatus: item.previousStatus ? item.previousStatus.toLowerCase() : null,
          newStatus: item.newStatus ? item.newStatus.toLowerCase() : null,
          oldStatus:
            item.action === 'user_status_changed' && item.previousStatus
              ? item.previousStatus.toLowerCase()
              : null,
          statusChange:
            item.action === 'user_status_changed'
              ? {
                  oldStatus: item.previousStatus ? item.previousStatus.toLowerCase() : null,
                  newStatus: item.newStatus ? item.newStatus.toLowerCase() : null,
                }
              : null,
          reason: item.reason,
          meta: item.meta,
          createdAt: item.createdAt.toISOString(),
        };
      }),
      pagination: {
        limit: query.limit,
        offset: query.offset,
        returned: items.length,
        hasMore: query.offset + items.length < total,
        total,
      },
    };
  }
}
