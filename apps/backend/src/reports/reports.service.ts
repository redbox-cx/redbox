import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Prisma, ReportedContentType } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { CreateBugReportDto } from './dto/create-bug-report.dto';
import { CreateContentReportDto } from './dto/create-content-report.dto';
import { encryptReportedContentPassword } from './report-content-password.util';

type ParsedContentLink = {
  contentType: ReportedContentType;
  contentId: string;
  token: string;
};

type ResolvedContentTarget = {
  contentType: ReportedContentType;
  reportedUserId: string;
  fileId: string | null;
  binId: string | null;
};

type PreparedBugAttachment = {
  filename: string;
  mimetype: string;
  size: number;
  storageKey: string;
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly s3: S3Client;
  private readonly bucket = process.env.S3_BUCKET_FILES || 'redbox-files';

  constructor(private readonly prismaService: PrismaService) {
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

  async createContentReport(dto: CreateContentReportDto) {
    const normalizedLink = dto.link.trim();
    const extractedPassword = this.extractPasswordFromLink(normalizedLink);
    const contentPassword = dto.contentPassword?.trim() || extractedPassword || null;
    const target = await this.resolveContentTarget(normalizedLink, contentPassword);
    const sanitizedLink = this.sanitizeContentLink(normalizedLink);
    const createData: Prisma.ContentReportUncheckedCreateInput = {
      contentType: target.contentType,
      reportedUserId: target.reportedUserId,
      fileId: target.fileId,
      binId: target.binId,
      contentLink: sanitizedLink,
      contentPasswordEncrypted: contentPassword
        ? encryptReportedContentPassword(contentPassword)
        : null,
      reason: dto.reason.trim(),
      reporterEmail: dto.reporterEmail?.trim().toLowerCase() || null,
    };

    const report = await this.prismaService.contentReport.create({
      data: createData,
      select: {
        id: true,
        createdAt: true,
      },
    });

    return {
      reportId: report.id,
      createdAt: report.createdAt.toISOString(),
    };
  }

  async createBugReport(dto: CreateBugReportDto, attachments: Express.Multer.File[] = []) {
    const normalizedDescription = dto.description.trim();
    const contactEmail = dto.contactEmail?.trim().toLowerCase() || null;
    const uploadedStorageKeys: string[] = [];
    const preparedAttachments: PreparedBugAttachment[] = [];

    this.assertBugAttachmentsAreValid(attachments);

    try {
      for (const attachment of attachments) {
        const storageKey = `bug_reports/${randomUUID()}.bin`;

        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: storageKey,
            Body: attachment.buffer,
            ContentType: attachment.mimetype,
          }),
        );

        uploadedStorageKeys.push(storageKey);
        preparedAttachments.push({
          filename: attachment.originalname || 'attachment',
          mimetype: attachment.mimetype,
          size: attachment.size,
          storageKey,
        });
      }

      const report = await this.prismaService.bugReport.create({
        data: {
          description: normalizedDescription,
          contactEmail,
          attachments: {
            create: preparedAttachments,
          },
        },
        select: {
          id: true,
          createdAt: true,
        },
      });

      return {
        reportId: report.id,
        createdAt: report.createdAt.toISOString(),
      };
    } catch (error) {
      await this.deleteUploadedBugAttachments(uploadedStorageKeys);
      throw error;
    }
  }

  private async resolveContentTarget(
    link: string,
    contentPassword: string | null,
  ): Promise<ResolvedContentTarget> {
    const parsedLink = this.parseContentLink(link);

    if (parsedLink.contentType === ReportedContentType.FILE) {
      const file = await this.prismaService.file.findFirst({
        where: {
          id: parsedLink.contentId,
          shareToken: parsedLink.token,
        },
        select: {
          id: true,
          userId: true,
          expiresAt: true,
          passwordHash: true,
        },
      });

      if (!file || new Date() > file.expiresAt) {
        throw new NotFoundException('The reported upload could not be found');
      }

      await this.assertProtectedContentPassword(
        file.passwordHash,
        contentPassword,
        'upload',
      );

      return {
        contentType: ReportedContentType.FILE,
        reportedUserId: file.userId,
        fileId: file.id,
        binId: null,
      };
    }

    const bin = await this.prismaService.bin.findFirst({
      where: {
        id: parsedLink.contentId,
        shareToken: parsedLink.token,
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        passwordHash: true,
      },
    });

    if (!bin || (bin.expiresAt !== null && new Date() > bin.expiresAt)) {
      throw new NotFoundException('The reported bin could not be found');
    }

    await this.assertProtectedContentPassword(
      bin.passwordHash,
      contentPassword,
      'bin',
    );

    return {
      contentType: ReportedContentType.BIN,
      reportedUserId: bin.userId,
      fileId: null,
      binId: bin.id,
    };
  }

  private parseContentLink(link: string): ParsedContentLink {
    const url = this.toUrl(link);
    const pathSegments = url.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));

    if (pathSegments[0] === 'd' && pathSegments[1]) {
      const token = url.searchParams.get('token');
      if (!token) {
        throw new BadRequestException('A share token is required in the reported upload link');
      }

      return {
        contentType: ReportedContentType.FILE,
        contentId: pathSegments[1],
        token,
      };
    }

    if (pathSegments[0] === 'b' && pathSegments[1]) {
      const token = url.searchParams.get('token');
      if (!token) {
        throw new BadRequestException('A share token is required in the reported bin link');
      }

      return {
        contentType: ReportedContentType.BIN,
        contentId: pathSegments[1],
        token,
      };
    }

    const filesDownloadIndex = pathSegments.findIndex(
      (segment, index) => segment === 'files' && pathSegments[index + 1] === 'download',
    );

    if (filesDownloadIndex >= 0 && pathSegments[filesDownloadIndex + 2]) {
      const token = url.searchParams.get('token');
      if (!token) {
        throw new BadRequestException('A share token is required in the reported upload link');
      }

      return {
        contentType: ReportedContentType.FILE,
        contentId: pathSegments[filesDownloadIndex + 2],
        token,
      };
    }

    const binsIndex = pathSegments.findIndex((segment) => segment === 'bins');
    if (binsIndex >= 0 && pathSegments[binsIndex + 1] && pathSegments[binsIndex + 2]) {
      return {
        contentType: ReportedContentType.BIN,
        contentId: pathSegments[binsIndex + 1],
        token: pathSegments[binsIndex + 2],
      };
    }

    throw new BadRequestException('Unsupported content link');
  }

  private toUrl(link: string) {
    try {
      return new URL(link);
    } catch {
      try {
        return new URL(link.startsWith('/') ? link : `/${link}`, 'https://redbox.local');
      } catch {
        throw new BadRequestException('Invalid content link');
      }
    }
  }

  private async assertProtectedContentPassword(
    passwordHash: string | null,
    contentPassword: string | null,
    contentTypeLabel: 'upload' | 'bin',
  ) {
    if (!passwordHash) {
      return;
    }

    if (!contentPassword) {
      throw new BadRequestException(
        `This ${contentTypeLabel} is password protected, so the report must include the password`,
      );
    }

    const isMatch = await bcrypt.compare(contentPassword, passwordHash);
    if (!isMatch) {
      throw new BadRequestException(`The provided password for this ${contentTypeLabel} is invalid`);
    }
  }

  private extractPasswordFromLink(link: string) {
    const url = this.toUrl(link);
    return url.searchParams.get('password')?.trim() || null;
  }

  private sanitizeContentLink(link: string) {
    const isAbsolute = this.isAbsoluteUrl(link);
    const url = this.toUrl(link);
    url.searchParams.delete('password');

    if (isAbsolute) {
      return url.toString();
    }

    return `${url.pathname}${url.search}${url.hash}`;
  }

  private isAbsoluteUrl(link: string) {
    try {
      new URL(link);
      return true;
    } catch {
      return false;
    }
  }

  private assertBugAttachmentsAreValid(attachments: Express.Multer.File[]) {
    for (const attachment of attachments) {
      if (!attachment.mimetype) {
        throw new BadRequestException('Each attachment must include a valid MIME type');
      }

      const isAllowedType =
        attachment.mimetype.startsWith('image/') || attachment.mimetype.startsWith('video/');

      if (!isAllowedType) {
        throw new BadRequestException('Bug report attachments must be images or videos');
      }
    }
  }

  private async deleteUploadedBugAttachments(keys: string[]) {
    await Promise.all(
      keys.map((key) =>
        this.s3
          .send(
            new DeleteObjectCommand({
              Bucket: this.bucket,
              Key: key,
            }),
          )
          .catch((error) => {
            this.logger.warn(`Failed to delete bug report attachment ${key}: ${String(error)}`);
          }),
      ),
    );
  }
}
