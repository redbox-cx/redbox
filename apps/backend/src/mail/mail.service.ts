import { Injectable, Logger, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { simpleParser } from 'mailparser';
import { IncomingMailDto } from './dto/incoming-mail.dto';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private prisma: PrismaService) {}


  async getUserMails(userId: string, limit: number = 50, offset: number = 0) {
    try {
      const mails = await this.prisma.mail.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          subject: true,
          from: true,
          to: true,
          isRead: true,
          createdAt: true
          // no content to keep it small
        }
      });

      const totalCount = await this.prisma.mail.count({ where: { userId } });

      return { mails, totalCount };
    } catch (error) {
      this.logger.error(`Error fetching mails for user ${userId}:`, error);
      throw new InternalServerErrorException('Could not fetch emails');
    }
  }


  async getSingleMail(userId: string, mailId: string) {
    try {
      const mail = await this.prisma.mail.findUnique({
        where: { id: mailId }
      });

      if (!mail || mail.userId !== userId) {
        throw new NotFoundException('Mail not found');
      }

      if (!mail.isRead) {
        await this.prisma.mail.update({
          where: { id: mailId },
          data: { isRead: true }
        });
      }

      return mail;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      
      this.logger.error(`Error fetching single mail ${mailId}:`, error);
      throw new InternalServerErrorException('Could not fetch email content');
    }
  }


  async processIncomingMail(dto: IncomingMailDto) {
    try {
      // sort clean mail
      const emailMatch = dto.to.match(/<([^>]+)>/);
      const cleanEmail = emailMatch ? emailMatch[1] : dto.to;
      
      // extract username
      const username = cleanEmail.split('@')[0].toLowerCase().trim();

      const user = await this.prisma.user.findUnique({
        where: { username }
      });

      if (!user) {
        this.logger.warn(`E-Mail rejected: User '${username}' does not exist. (Original TO: ${dto.to})`);
        return { status: 'ignored', reason: 'User not found' };
      }

      const parsed = await simpleParser(dto.raw);

      const mail = await this.prisma.mail.create({
        data: {
          from: dto.from,
          to: dto.to,
          subject: parsed.subject || dto.subject || '(No subject)',
          content: parsed.html || parsed.textAsHtml || parsed.text || '(No content)',
          userId: user.id
        }
      });

      this.logger.log(`Email from ${dto.from} for user '${username}' saved`);
      return { status: 'success', mailId: mail.id };

    } catch (error) {
      this.logger.error('Error while parsing of the mail:', error);
      throw error;
    }
  }
}