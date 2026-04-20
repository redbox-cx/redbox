import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { AuditActorType, Prisma } from '@prisma/client';
import { Readable } from 'stream';
import { PrismaService } from 'src/prisma.service';
import {
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
  private readonly s3: S3Client;
  private readonly bugAttachmentsBucket = process.env.S3_BUCKET_FILES || 'redbox-files';

  constructor(
    private readonly prismaService: PrismaService,
    private readonly adminUsersService: AdminUsersService,
  ) {
    this.s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'admin_redbox',
        secretAccessKey: process.env.S3_SECRET_KEY || 'SuperSecretMinioPassword123',
      },
      forcePathStyle: true,
    });
  }

  async getOpenReportsCount() {
    const [contentReportsOpen, bugReportsOpen] = await Promise.all([
      this.prismaService.contentReport.count({
        where: { resolvedAt: null },
      }),
      this.prismaService.bugReport.count({
        where: { resolvedAt: null },
      }),
    ]);

    return contentReportsOpen + bugReportsOpen;
  }

  async getReportsSummary() {
    const [contentReportsOpen, contentReportsArchived, bugReportsOpen, bugReportsArchived] =
      await Promise.all([
        this.prismaService.contentReport.count({
          where: { resolvedAt: null },
        }),
        this.prismaService.contentReport.count({
          where: { resolvedAt: { not: null } },
        }),
        this.prismaService.bugReport.count({
          where: { resolvedAt: null },
        }),
        this.prismaService.bugReport.count({
          where: { resolvedAt: { not: null } },
        }),
      ]);

    return {
      openReports: contentReportsOpen + bugReportsOpen,
      contentReportsOpen,
      bugReportsOpen,
      archivedReports: contentReportsArchived + bugReportsArchived,
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
      const contentPassword = decryptReportedContentPassword(report.contentPasswordEncrypted);
      const reviewLink = this.buildReviewLink(report.contentLink, contentPassword);

      return {
        id: report.id,
        reportedUser: {
          username: report.reportedUser.username,
          uuid: report.reportedUser.id,
          joinDate: report.reportedUser.createdAt.toISOString(),
        },
        timestamp: report.createdAt.toISOString(),
        link: reviewLink,
        reviewLink,
        rawLink: report.contentLink,
        hasDecryptionKey: this.hasDecryptionKey(report.contentLink),
        fileSize: resource?.size ?? 0,
        fileCreationDate: resource?.createdAt?.toISOString() ?? report.createdAt.toISOString(),
        reason: report.reason,
        reporterEmail: report.reporterEmail,
        contentPassword,
        hasContentPassword: Boolean(report.contentPasswordEncrypted),
        fileId: report.fileId ?? report.binId ?? undefined,
        contentType: report.contentType.toLowerCase(),
      };
    });
  }

  async getBugReports(query: OffsetPaginationQueryDto) {
    const reports = await this.prismaService.bugReport.findMany({
      where: { resolvedAt: null },
      include: {
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: query.offset,
      take: query.limit,
    });

    return reports.map((report): AdminBugReport & {
      attachmentItems: Array<{
        id: string;
        filename: string;
        mimetype: string;
        size: number;
        downloadUrl: string;
      }>;
    } => ({
      id: report.id,
      subject: this.buildBugReportSubject(report.description),
      timestamp: report.createdAt.toISOString(),
      description: report.description,
      attachments: report.attachments.map((attachment) => attachment.filename),
      attachmentItems: report.attachments.map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        mimetype: attachment.mimetype,
        size: attachment.size,
        downloadUrl: `/admin/reports/bugs/${report.id}/attachments/${attachment.id}`,
      })),
      reporterEmail: report.contactEmail,
    }));
  }

  async getArchivedReports(query: OffsetPaginationQueryDto) {
    const [archivedContentReports, archivedBugReports] = await Promise.all([
      this.prismaService.contentReport.findMany({
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
      }),
      this.prismaService.bugReport.findMany({
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
      }),
    ]);

    const combinedItems = [
      ...archivedContentReports.map((report) => ({
        id: report.id,
        originalType: report.contentType === 'FILE' ? 'Upload report' : 'Bin report',
        subject: report.contentLink,
        timestamp: report.resolvedAt?.toISOString() ?? report.createdAt.toISOString(),
        resolvedBy: report.resolvedByAdminUser?.username ?? 'Admin',
        actionTaken: report.actionTaken ?? 'Report resolved',
      })),
      ...archivedBugReports.map((report) => ({
        id: report.id,
        originalType: 'Bug report',
        subject: this.buildBugReportSubject(report.description),
        timestamp: report.resolvedAt?.toISOString() ?? report.createdAt.toISOString(),
        resolvedBy: report.resolvedByAdminUser?.username ?? 'Admin',
        actionTaken: report.actionTaken ?? 'Bug report resolved',
      })),
    ]
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
      .slice(query.offset, query.offset + query.limit);

    return combinedItems;
  }

  async downloadBugReportAttachment(reportId: string, attachmentId: string) {
    const attachment = await this.prismaService.bugReportAttachment.findFirst({
      where: {
        id: attachmentId,
        bugReportId: reportId,
      },
      select: {
        filename: true,
        mimetype: true,
        storageKey: true,
      },
    });

    if (!attachment) {
      throw new NotFoundException('Bug report attachment not found');
    }

    const object = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bugAttachmentsBucket,
        Key: attachment.storageKey,
      }),
    );

    if (!object.Body) {
      throw new NotFoundException('Bug report attachment file not found');
    }

    return {
      filename: attachment.filename,
      mimetype: attachment.mimetype,
      stream: object.Body as Readable,
    };
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
        meta: this.buildContentReportAuditMeta(report, {
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
    const durationDays =
      dto.duration === '30d' ? 30 : dto.duration === 'custom' ? dto.customDays : undefined;

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
        meta: this.buildContentReportAuditMeta(report, {
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
          meta: this.buildContentReportAuditMeta(contentReport),
        });
      });

      return {
        success: true,
        message: 'Report resolved and archived',
      };
    }

    const bugReport = await this.prismaService.bugReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        description: true,
        resolvedAt: true,
      },
    });

    if (bugReport) {
      if (bugReport.resolvedAt) {
        throw new BadRequestException('Report is already archived');
      }

      await this.prismaService.$transaction(async (prisma) => {
        await prisma.bugReport.update({
          where: { id: reportId },
          data: {
            resolvedAt: new Date(),
            actionTaken: dto.reason,
            resolvedByAdminUserId: adminUserId,
          },
        });

        await this.createAuditLog(prisma, {
          adminUserId,
          action: 'bug_report_resolved',
          reason: dto.reason,
          meta: this.buildBugReportAuditMeta(bugReport),
        });
      });

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

    if (report) {
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
          meta: this.buildContentReportAuditMeta(report),
        });
      });

      return {
        success: true,
        message: 'Report reopened successfully',
      };
    }

    const bugReport = await this.prismaService.bugReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        description: true,
        resolvedAt: true,
      },
    });

    if (bugReport) {
      if (!bugReport.resolvedAt) {
        throw new BadRequestException('Report is already open');
      }

      await this.prismaService.$transaction(async (prisma) => {
        await prisma.bugReport.update({
          where: { id: reportId },
          data: {
            resolvedAt: null,
            actionTaken: null,
            resolvedByAdminUserId: null,
          },
        });

        await this.createAuditLog(prisma, {
          adminUserId,
          action: 'bug_report_reopened',
          reason: dto.reason,
          meta: this.buildBugReportAuditMeta(bugReport),
        });
      });

      return {
        success: true,
        message: 'Report reopened successfully',
      };
    }

    throw new NotFoundException('Report not found');
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

  private buildContentReportAuditMeta(
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

  private buildBugReportAuditMeta(
    report: {
      id: string;
      description: string;
    },
    extra: Record<string, unknown> = {},
  ): Prisma.InputJsonValue {
    return {
      reportId: report.id,
      reportType: 'bug',
      subject: this.buildBugReportSubject(report.description),
      ...extra,
    };
  }

  private buildBugReportSubject(description: string) {
    const compactDescription = description.replace(/\s+/g, ' ').trim();

    if (!compactDescription) {
      return 'Bug report';
    }

    return compactDescription.length > 80
      ? `${compactDescription.slice(0, 77)}...`
      : compactDescription;
  }

  private buildReviewLink(link: string, contentPassword: string | null) {
    const isAbsolute = this.isAbsoluteUrl(link);
    const url = this.toUrl(link);

    if (contentPassword) {
      url.searchParams.set('password', contentPassword);
    }

    if (isAbsolute) {
      return url.toString();
    }

    return `${url.pathname}${url.search}${url.hash}`;
  }

  private hasDecryptionKey(link: string) {
    return this.toUrl(link).hash.length > 1;
  }

  private toUrl(link: string) {
    try {
      return new URL(link);
    } catch {
      return new URL(link.startsWith('/') ? link : `/${link}`, 'https://redbox.local');
    }
  }

  private isAbsoluteUrl(link: string) {
    try {
      new URL(link);
      return true;
    } catch {
      return false;
    }
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
}
