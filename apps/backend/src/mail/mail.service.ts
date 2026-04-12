import { Injectable, Logger, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { simpleParser } from 'mailparser';
import { IncomingMailDto } from './dto/incoming-mail.dto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';


@Injectable()
export class MailService {

  private readonly logger = new Logger(MailService.name);
  private readonly s3: S3Client;
  private readonly bucket = process.env.S3_BUCKET_MAILS || 'redbox-mails';

  constructor(private prisma: PrismaService) {
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

  async getUserMails(
    userId: string, 
    limit: number = 50, 
    offset: number = 0, 
    sort: string = 'newest',
    folder: string = 'inbox'
  ) {
    let orderBy: any = { createdAt: 'desc' };

    if (sort === 'oldest') orderBy = { createdAt: 'asc' };
    if (sort === 'unread') orderBy = [{ isRead: 'asc' }, { createdAt: 'desc' }];
    if (sort === 'read') orderBy = [{ isRead: 'desc' }, { createdAt: 'desc' }];

    let whereCondition: any = { userId };

    if (folder === 'inbox') {
      whereCondition.isArchived = false;
      whereCondition.isSpam = false;
    } else if (folder === 'archive') {
      whereCondition.isArchived = true;
      whereCondition.isSpam = false;
    } else if (folder === 'spam') {
      whereCondition.isSpam = true;
    } 

    const mails = await this.prisma.mail.findMany({
      where: whereCondition,
      orderBy,
      take: limit,
      skip: offset,
      select: {
        id: true,
        subject: true,
        from: true,
        to: true,
        isRead: true,
        isArchived: true,
        isSpam: true,
        createdAt: true,
      }
    });

    const totalCount = await this.prisma.mail.count({ where: whereCondition });
    
    return { mails, totalCount, folder };
  }

  async getSingleMail(userId: string, mailId: string) {
    const mail = await this.prisma.mail.findUnique({ where: { id: mailId } });
    if (!mail || mail.userId !== userId) throw new NotFoundException('Mail not found');

    if (!mail.isRead) {
      await this.prisma.mail.update({ where: { id: mailId }, data: { isRead: true } });
    }

    try {
      const s3Response = await this.s3.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: mail.storageKey,
      }));
      const content = await s3Response.Body!.transformToString('utf-8');
      return { ...mail, content };
    } catch (err) {
      this.logger.error('S3 GetObject Error:', err);
      throw new InternalServerErrorException('Could not load email content from storage');
    }
  }


  async deleteMail(userId: string, mailId: string) {
    const mail = await this.prisma.mail.findFirst({ where: { id: mailId, userId } });
    if (!mail) throw new NotFoundException('Mail not found');

    // del from s3
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: mail.storageKey })).catch(err => {
      this.logger.error(`Failed to delete S3 object ${mail.storageKey}`, err);
    });

    // del from db
    await this.prisma.mail.delete({ where: { id: mailId } });
    return { success: true };
  }

  async moveMail(userId: string, mailId: string, folder: string) {
    const mail = await this.prisma.mail.findFirst({ where: { id: mailId, userId } });
    if (!mail) throw new NotFoundException('Mail not found');

    let isArchived = false;
    let isSpam = false;

    if (folder === 'archive') isArchived = true;
    if (folder === 'spam') isSpam = true;

    await this.prisma.mail.update({ 
      where: { id: mailId }, 
      data: { isArchived, isSpam } 
    });

    return { success: true, folder };
  }

  async bulkMoveMails(userId: string, mailIds: string[], folder: string) {
    let isArchived = false;
    let isSpam = false;

    if (folder === 'archive') isArchived = true;
    if (folder === 'spam') isSpam = true;

    const result = await this.prisma.mail.updateMany({
      where: { id: { in: mailIds }, userId },
      data: { isArchived, isSpam }
    });

    return { movedCount: result.count, folder };
  }

  async setReadStatus(userId: string, mailId: string, isRead: boolean) {
    const mail = await this.prisma.mail.findFirst({ where: { id: mailId, userId } });
    if (!mail) throw new NotFoundException('Mail not found');
    await this.prisma.mail.update({ where: { id: mailId }, data: { isRead } });
    return { success: true };
  }

  // --- BULK ACTIONS ---

  async bulkDeleteMails(userId: string, mailIds: string[]) {
    const mails = await this.prisma.mail.findMany({ where: { id: { in: mailIds }, userId } });
    
    // del all found mails from s3
    await Promise.all(mails.map(mail => 
      this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: mail.storageKey })).catch(err => 
        this.logger.error(`Failed to delete S3 object ${mail.storageKey}`, err)
      )
    ));

    // del from db
    const result = await this.prisma.mail.deleteMany({ where: { id: { in: mailIds }, userId } });
    return { deletedCount: result.count };
  }

  async bulkArchiveMails(userId: string, mailIds: string[]) {
    const result = await this.prisma.mail.updateMany({
      where: { id: { in: mailIds }, userId },
      data: { isArchived: true }
    });
    return { archivedCount: result.count };
  }

  async bulkSetReadStatus(userId: string, mailIds: string[], isRead: boolean) {
    const result = await this.prisma.mail.updateMany({
      where: { id: { in: mailIds }, userId },
      data: { isRead }
    });
    return { updatedCount: result.count };
  }

  // --- SENDER BLOCKING ---

  async blockSender(userId: string, emailToBlock: string) {
    const email = emailToBlock.toLowerCase().trim();
    await this.prisma.blockedSender.upsert({
      where: { userId_email: { userId, email } },
      update: {},
      create: { userId, email }
    });
    return { success: true, blockedEmail: email };
  }

  // --- INCOMING MAIL ---
  async processIncomingMail(dto: IncomingMailDto) {
    const emailMatch = dto.to.match(/<([^>]+)>/);
    const cleanEmail = emailMatch ? emailMatch[1] : dto.to;
    const username = cleanEmail.split('@')[0].toLowerCase().trim();

    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) return { status: 'ignored', reason: 'User not found' };

    const fromMatch = dto.from.match(/<([^>]+)>/);
    const senderEmail = (fromMatch ? fromMatch[1] : dto.from).toLowerCase().trim();
    const isBlocked = await this.prisma.blockedSender.findUnique({
      where: { userId_email: { userId: user.id, email: senderEmail } }
    });
    if (isBlocked) {
      this.logger.log(`Ignored email from blocked sender: ${senderEmail} for user ${username}`);
      return { status: 'ignored', reason: 'Sender is blocked' };
    }

    const parsed = await simpleParser(dto.raw);
    const mailContent = parsed.html || parsed.textAsHtml || parsed.text || '(No content)';
    const storageKey = `mail_${uuidv4()}.html`;

    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      Body: mailContent,
      ContentType: 'text/html',
    }));

    const mail = await this.prisma.mail.create({
      data: {
        from: dto.from,
        to: dto.to,
        subject: parsed.subject || dto.subject || '(No subject)',
        storageKey: storageKey,
        userId: user.id
      }
    });

    this.logger.log(`Email from ${dto.from} for user '${username}' saved to MinIO`);
    return { status: 'success', mailId: mail.id };
  }
}