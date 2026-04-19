import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma, ReportedContentType } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
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

@Injectable()
export class ReportsService {
  constructor(private readonly prismaService: PrismaService) {}

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
}
