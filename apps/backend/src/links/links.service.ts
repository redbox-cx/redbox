import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { randomBytes } from 'crypto';

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
}