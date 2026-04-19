import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import {
  ADMIN_BUG_REPORTS,
  ADMIN_REPORTS_HISTORY,
  type AdminBugReport,
} from '../admin.data';
import {
  AdminContentReportsQueryDto,
  BanReportedUserDto,
  DeleteReportedContentDto,
  ReopenAdminReportDto,
  ResolveAdminReportDto,
} from '../dto/reports.dto';
import { OffsetPaginationQueryDto } from '../dto/common.dto';
import { AdminUsersService } from '../users/admin-users.service';
import { decryptReportedContentPassword } from 'src/reports/report-content-password.util';

function clone<T>(value: T): T {
  return structuredClone(value);
}

@Injectable()
export class AdminReportsService {
  private bugReports: AdminBugReport[] = clone(ADMIN_BUG_REPORTS);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly adminUsersService: AdminUsersService,
  ) {}

  async getOpenReportsCount() {
    const contentReportsOpen = await this.prismaService.contentReport.count({
      where: { resolvedAt: null },
    });

    return contentReportsOpen + this.bugReports.length;
  }

  async getReportsSummary() {
    const [contentReportsOpen, archivedReports] = await Promise.all([
      this.prismaService.contentReport.count({
        where: { resolvedAt: null },
      }),
      this.prismaService.contentReport.count({
        where: { resolvedAt: { not: null } },
      }),
    ]);

    return {
      openReports: contentReportsOpen + this.bugReports.length,
      contentReportsOpen,
      bugReportsOpen: this.bugReports.length,
      archivedReports,
      history: clone(ADMIN_REPORTS_HISTORY),
    };
  }

  async getContentReports(query: AdminContentReportsQueryDto) {
    const reports = await this.prismaService.contentReport.findMany({
      where: {
        resolvedAt: query.status === 'archived' ? { not: null } : null,
      },
      select: {
        id: true,
        createdAt: true,
        contentLink: true,
        contentPasswordEncrypted: true,
        reason: true,
        reporterEmail: true,
        fileId: true,
        binId: true,
        contentType: true,
        reportedUser: {
          select: {
            id: true,
            username: true,
            createdAt: true,
          },
        },
        file: {
          select: {
            id: true,
            size: true,
            createdAt: true,
          },
        },
        bin: {
          select: {
            id: true,
            size: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: query.offset,
      take: query.limit,
    });

    return reports.map((report) => {
      const resource = report.file ?? report.bin;

      return {
        id: report.id,
        reportedUser: {
          username: report.reportedUser.username,
          uuid: report.reportedUser.id,
          joinDate: report.reportedUser.createdAt.toISOString(),
        },
        timestamp: report.createdAt.toISOString(),
        link: report.contentLink,
        fileSize: resource?.size ?? 0,
        fileCreationDate: resource?.createdAt?.toISOString() ?? report.createdAt.toISOString(),
        reason: report.reason,
        reporterEmail: report.reporterEmail,
        contentPassword: decryptReportedContentPassword(report.contentPasswordEncrypted),
        hasContentPassword: Boolean(report.contentPasswordEncrypted),
        fileId: report.fileId ?? report.binId ?? undefined,
        contentType: report.contentType.toLowerCase(),
      };
    });
  }

  getBugReports(query: OffsetPaginationQueryDto) {
    return this.paginateArray(this.bugReports, query);
  }

  async getArchivedReports(query: OffsetPaginationQueryDto) {
    const archivedReports = await this.prismaService.contentReport.findMany({
      where: {
        resolvedAt: { not: null },
      },
      include: {
        resolvedByAdminUser: {
          select: {
            username: true,
          },
        },
      },
      orderBy: { resolvedAt: 'desc' },
      skip: query.offset,
      take: query.limit,
    });

    return archivedReports.map((report) => ({
      id: report.id,
      originalType: report.contentType === 'FILE' ? 'Upload report' : 'Bin report',
      subject: report.contentLink,
      timestamp: report.resolvedAt?.toISOString() ?? report.createdAt.toISOString(),
      resolvedBy: report.resolvedByAdminUser?.username ?? 'Admin',
      actionTaken: report.actionTaken ?? 'Report resolved',
    }));
  }

  async deleteReportedContent(
    reportId: string,
    dto: DeleteReportedContentDto,
    adminUserId: string,
  ) {
    const report = await this.findOpenContentReportOrThrow(reportId);

    if (report.contentType === 'FILE') {
      if (!report.fileId) {
        throw new BadRequestException('Reported file has already been deleted');
      }

      const result = await this.adminUsersService.deleteUserFiles(
        adminUserId,
        report.reportedUserId,
        {
          fileIds: [report.fileId],
          reason: dto.reason,
        },
      );

      if (result.deletedCount === 0) {
        throw new BadRequestException('Reported file has already been deleted');
      }
    } else {
      if (!report.binId) {
        throw new BadRequestException('Reported bin has already been deleted');
      }

      await this.prismaService.$transaction(async (prisma) => {
        const deleted = await prisma.bin.deleteMany({
          where: {
            id: report.binId!,
            userId: report.reportedUserId,
          },
        });

        if (deleted.count === 0) {
          throw new BadRequestException('Reported bin has already been deleted');
        }
      });
    }

    await this.prismaService.adminAuditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        adminUserId,
        targetUserId: report.reportedUserId,
        action: 'report_content_deleted',
        reason: dto.reason,
        meta: this.buildReportAuditMeta(report, {
          deletedContentType: report.contentType.toLowerCase(),
          deletedContentId: report.fileId ?? report.binId,
        }),
      },
    });

    return {
      success: true,
      message: 'Reported content deleted successfully',
    };
  }

  async banReportedUser(reportId: string, dto: BanReportedUserDto, adminUserId: string) {
    const report = await this.findOpenContentReportOrThrow(reportId);
    const durationDays = dto.duration === '30d' ? 30 : dto.duration === 'custom' ? dto.customDays : undefined;

    await this.adminUsersService.updateUserStatus(adminUserId, report.reportedUserId, {
      status: 'banned',
      reason: dto.reason,
      permanent: dto.duration === 'permanent',
      durationDays,
    });

    await this.prismaService.adminAuditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        adminUserId,
        targetUserId: report.reportedUserId,
        action: 'report_user_banned',
        reason: dto.reason,
        meta: this.buildReportAuditMeta(report, {
          banDuration: dto.duration,
          customDays: dto.duration === 'custom' ? dto.customDays : null,
          durationDays: durationDays ?? null,
          permanent: dto.duration === 'permanent',
        }),
      },
    });

    return {
      success: true,
      message: 'Reported user banned successfully',
    };
  }

  async resolveReport(reportId: string, dto: ResolveAdminReportDto, adminUserId: string) {
    const contentReport = await this.prismaService.contentReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        reportedUserId: true,
        contentType: true,
        contentLink: true,
        fileId: true,
        binId: true,
        resolvedAt: true,
      },
    });

    if (contentReport) {
      if (contentReport.resolvedAt) {
        throw new BadRequestException('Report is already archived');
      }

      await this.prismaService.$transaction(async (prisma) => {
        await prisma.contentReport.update({
          where: { id: reportId },
          data: {
            resolvedAt: new Date(),
            actionTaken: dto.reason,
            resolvedByAdminUserId: adminUserId,
          },
        });

        await this.createAuditLog(prisma, {
          adminUserId,
          targetUserId: contentReport.reportedUserId,
          action: 'report_resolved',
          reason: dto.reason,
          meta: this.buildReportAuditMeta(contentReport),
        });
      });

      return {
        success: true,
        message: 'Report resolved and archived',
      };
    }

    const bugReport = this.bugReports.find((report) => report.id === reportId);
    if (bugReport) {
      this.bugReports = this.bugReports.filter((report) => report.id !== reportId);
      return {
        success: true,
        message: 'Report resolved and archived',
      };
    }

    throw new NotFoundException('Report not found');
  }

  async reopenReport(reportId: string, dto: ReopenAdminReportDto, adminUserId: string) {
    const report = await this.prismaService.contentReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        reportedUserId: true,
        contentType: true,
        contentLink: true,
        fileId: true,
        binId: true,
        resolvedAt: true,
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (!report.resolvedAt) {
      throw new BadRequestException('Report is already open');
    }

    await this.prismaService.$transaction(async (prisma) => {
      await prisma.contentReport.update({
        where: { id: reportId },
        data: {
          resolvedAt: null,
          actionTaken: null,
          resolvedByAdminUserId: null,
        },
      });

      await this.createAuditLog(prisma, {
        adminUserId,
        targetUserId: report.reportedUserId,
        action: 'report_reopened',
        reason: dto.reason,
        meta: this.buildReportAuditMeta(report),
      });
    });

    return {
      success: true,
      message: 'Report reopened successfully',
    };
  }

  private async findOpenContentReportOrThrow(reportId: string) {
    const report = await this.prismaService.contentReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        reportedUserId: true,
        contentType: true,
        contentLink: true,
        fileId: true,
        binId: true,
        resolvedAt: true,
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.resolvedAt) {
      throw new BadRequestException('Report is already archived');
    }

    return report;
  }

  private buildReportAuditMeta(
    report: {
      id: string;
      contentType: 'FILE' | 'BIN' | string;
      contentLink: string;
      fileId: string | null;
      binId: string | null;
    },
    extra: Record<string, unknown> = {},
  ): Prisma.InputJsonValue {
    return {
      reportId: report.id,
      contentType: report.contentType.toLowerCase(),
      contentLink: report.contentLink,
      fileId: report.fileId,
      binId: report.binId,
      ...extra,
    };
  }

  private async createAuditLog(
    prisma: Prisma.TransactionClient,
    params: {
      adminUserId: string;
      targetUserId?: string;
      action: string;
      reason: string;
      meta?: Prisma.InputJsonValue;
    },
  ) {
    await prisma.adminAuditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        adminUserId: params.adminUserId,
        targetUserId: params.targetUserId ?? null,
        action: params.action,
        reason: params.reason,
        meta: params.meta,
      },
    });
  }

  private paginateArray<T>(items: T[], query: OffsetPaginationQueryDto) {
    return clone(items.slice(query.offset, query.offset + query.limit));
  }
}
