import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ReportedContentType } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { CreateContentReportDto } from './dto/create-content-report.dto';

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
    const target = await this.resolveContentTarget(normalizedLink);

    const report = await this.prismaService.contentReport.create({
      data: {
        contentType: target.contentType,
        reportedUserId: target.reportedUserId,
        fileId: target.fileId,
        binId: target.binId,
        contentLink: normalizedLink,
        reason: dto.reason.trim(),
        reporterEmail: dto.reporterEmail?.trim().toLowerCase() || null,
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
  }

  private async resolveContentTarget(link: string): Promise<ResolvedContentTarget> {
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
        },
      });

      if (!file || new Date() > file.expiresAt) {
        throw new NotFoundException('The reported upload could not be found');
      }

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
      },
    });

    if (!bin || (bin.expiresAt !== null && new Date() > bin.expiresAt)) {
      throw new NotFoundException('The reported bin could not be found');
    }

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
}
