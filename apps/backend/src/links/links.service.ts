import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { randomBytes } from 'crypto';

const SHORT_CODE_BYTES = 3;
const MAX_SHORT_CODE_ATTEMPTS = 8;

@Injectable()
export class LinksService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, url: string) {
    const count = await this.prisma.link.count({
      where: { userId },
    });

    const linkLimit = Number(process.env.LINK_LIMIT ?? 25);

    if (count >= linkLimit) {
      throw new BadRequestException(`You have reached the limit of ${linkLimit} links.`);
    }

    for (let attempt = 0; attempt < MAX_SHORT_CODE_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.link.create({
          data: {
            originalUrl: url,
            shortCode: this.createShortCode(),
            userId,
          },
        });
      } catch (error) {
        if (!this.isUniqueConflict(error)) {
          throw error;
        }
      }
    }

    throw new BadRequestException('Could not generate a unique short code');
  }

  async findAllByUser(userId: string) {
    return this.prisma.link.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(userId: string, linkId: string) {
    
    // find link + check permissions
    const link = await this.prisma.link.findUnique({
      where: { id: linkId },
      select: { userId: true },
    });

    if (!link) {
      throw new NotFoundException(`Link with ID ${linkId} not found.`);
    }

    if (link.userId !== userId) {
      throw new ForbiddenException(`Link with ID ${linkId} not found.`);
    }

    // delete
    await this.prisma.link.delete({
      where: { id: linkId },
    });

    return { message: 'Link successfully deleted' };
  }

  async getOriginalUrl(code: string) {
    const link = await this.prisma.link.findUnique({
      where: { shortCode: code },
    });

    if (!link) throw new NotFoundException('Link not found');
    return link.originalUrl;
  }

  private createShortCode() {
    return randomBytes(SHORT_CODE_BYTES).toString('hex');
  }

  private isUniqueConflict(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
