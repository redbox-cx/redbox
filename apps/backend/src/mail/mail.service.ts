import { Injectable, Logger, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { simpleParser } from 'mailparser';
import { IncomingMailDto } from './dto/incoming-mail.dto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { publicEncrypt, privateDecrypt, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';


@Injectable()
export class MailService {

  private readonly logger = new Logger(MailService.name);
  private readonly s3: S3Client;
  private readonly bucket = process.env.S3_BUCKET_MAILS || 'redbox-mails';

  constructor(
    private prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis
  ){
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
    folder: string = 'inbox',
    search?: string
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

    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      whereCondition.AND = [
        {
          OR:[
            { subject: { contains: searchTerm } },
            { from: { contains: searchTerm } }
          ]
        }
      ];
    }

    try {
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
      
      return { mails, totalCount, folder, search };
    } catch (error) {
      this.logger.error(`Error fetching mails for user ${userId}:`, error);
      throw new InternalServerErrorException('Could not fetch emails');
    }
  }

  async getSingleMail(userId: string, mailId: string) {
    const mail = await this.prisma.mail.findUnique({ where: { id: mailId } });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    if (!mail || mail.userId !== userId || !user) throw new NotFoundException('Mail not found');

    // 1. Take masterkey from redis
    const rawMasterKeyHex = await this.redis.get(`masterkey:${userId}`);
    if (!rawMasterKeyHex) {
        throw new UnauthorizedException('MasterKey not found in cache. Please re-login.');
    }
    const rawMasterKey = Buffer.from(rawMasterKeyHex, 'hex');

    // 2. decrypt RSA Private Key of user
    const privDecipher = createDecipheriv('aes-256-cbc', rawMasterKey, Buffer.from(user.privateKeyIv, 'hex'));
    let privateKeyPem = privDecipher.update(Buffer.from(user.encryptedPrivateKey, 'hex'));
    privateKeyPem = Buffer.concat([privateKeyPem, privDecipher.final()]);

    // 3. decrypt mail-specific aes-key
    const mailKey = privateDecrypt(
        privateKeyPem.toString('utf8'),
        Buffer.from(mail.encryptedMailKey, 'hex')
    );

    // 4. take encrypted content from s3
    const s3Response = await this.s3.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: mail.storageKey,
    }));
    const encryptedContentBuffer = Buffer.from(await s3Response.Body!.transformToByteArray());

    // 5. decrypt content
    const contentDecipher = createDecipheriv('aes-256-cbc', mailKey, Buffer.from(mail.mailKeyIv, 'hex'));
    let decryptedContent = contentDecipher.update(encryptedContentBuffer);
    decryptedContent = Buffer.concat([decryptedContent, contentDecipher.final()]);

    // update read-status
    if (!mail.isRead) {
      await this.prisma.mail.update({ where: { id: mailId }, data: { isRead: true } });
    }

    return { ...mail, content: decryptedContent.toString('utf8') };
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
    const storageKey = `mail_${uuidv4()}.bin`;

    const mailKey = randomBytes(32);
    const mailIv = randomBytes(16);

    const cipher = createCipheriv('aes-256-cbc', mailKey, mailIv);
    const encryptedContent = Buffer.concat([cipher.update(mailContent, 'utf8'), cipher.final()]);

    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      Body: encryptedContent,
      ContentType: 'application/octet-stream',
    }));

    const encryptedMailKey = publicEncrypt(
        user.publicKey,
        mailKey
    ).toString('hex');

    const mail = await this.prisma.mail.create({
      data: {
        from: dto.from,
        to: dto.to,
        subject: parsed.subject || dto.subject || '(No subject)',
        storageKey: storageKey,
        userId: user.id,
        encryptedMailKey: encryptedMailKey,
        mailKeyIv: mailIv.toString('hex')
      }
    });

    return { status: 'success', mailId: mail.id };
  }
}