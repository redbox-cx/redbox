import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class LinksService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, url: string) {
    const count = await this.prisma.link.count({
      where: { userId },
    });

    const linkLimit = Number(process.env.LINK_LIMIT ?? 25);

    if (count >= linkLimit) {
      throw new BadRequestException(`You have reached the limit of ${linkLimit} links.`);
    }

    // generate short code
    const shortCode = randomBytes(3).toString('hex');

    // save in db
    return this.prisma.link.create({
      data: {
        originalUrl: url,
        shortCode,
        userId,
      },
    });
  }

  async findAllByUser(userId: number) {
    return this.prisma.link.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOriginalUrl(code: string) {
    const link = await this.prisma.link.findUnique({
      where: { shortCode: code },
    });

    if (!link) throw new NotFoundException('Link not found');
    return link.originalUrl;
  }
}