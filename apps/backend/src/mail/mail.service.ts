import { Injectable, Logger, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
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
  private readonly MAX_MAIL_QUOTA = 500 * 1024 * 1024; // 500MB
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

  private async getUserMailStorageUsed(userId: string) {
    const [mailAggregation, attachmentAggregation] = await Promise.all([
      this.prisma.mail.aggregate({
        where: { userId },
        _sum: { contentSize: true },
      }),
      this.prisma.mailAttachment.aggregate({
        where: { mail: { userId } },
        _sum: { size: true },
      }),
    ]);

    return (
      Number(mailAggregation._sum.contentSize ?? 0) +
      Number(attachmentAggregation._sum.size ?? 0)
    );
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
      const [rawMails, totalCount, totalUsed] = await Promise.all([
        this.prisma.mail.findMany({
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
            _count: {
              select: { attachments: true}
            }
          }
        }),
        this.prisma.mail.count({ where: whereCondition }),
        this.getUserMailStorageUsed(userId),
      ]);

      const mails = rawMails.map(mail => {
        const { _count, ...rest } = mail;
        return {
          ...rest,
          attachmentCount: _count.attachments,
          hasAttachments: _count.attachments > 0       // true / false
        };
      });
      
      return {
        mails,
        totalCount,
        folder,
        search,
        totalUsed,
        quotaLimit: this.MAX_MAIL_QUOTA,
      };
    } catch (error) {
      this.logger.error(`Error fetching mails for user ${userId}:`, error);
      throw new InternalServerErrorException('Could not fetch emails');
    }
  }

  async getSingleMail(userId: string, mailId: string) {
    const mail = await this.prisma.mail.findUnique({ 
      where: { id: mailId },
      include: { attachments: true }
    });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    if (!mail || mail.userId !== userId || !user) throw new NotFoundException('Mail not found');

    // encryption
    const rawMasterKeyHex = await this.redis.get(`masterkey:${userId}`);
    if (!rawMasterKeyHex) {
        throw new UnauthorizedException('MasterKey not found in cache. Please re-login.');
    }
    const rawMasterKey = Buffer.from(rawMasterKeyHex, 'hex');

    const privDecipher = createDecipheriv('aes-256-cbc', rawMasterKey, Buffer.from(user.privateKeyIv, 'hex'));
    let privateKeyPem = privDecipher.update(Buffer.from(user.encryptedPrivateKey, 'hex'));
    privateKeyPem = Buffer.concat([privateKeyPem, privDecipher.final()]);

    const mailKey = privateDecrypt(
        privateKeyPem.toString('utf8'),
        Buffer.from(mail.encryptedMailKey, 'hex')
    );

    const s3Response = await this.s3.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: mail.storageKey,
    }));
    const encryptedContentBuffer = Buffer.from(await s3Response.Body!.transformToByteArray());

    const contentDecipher = createDecipheriv('aes-256-cbc', mailKey, Buffer.from(mail.mailKeyIv, 'hex'));
    let decryptedContent = contentDecipher.update(encryptedContentBuffer);
    decryptedContent = Buffer.concat([decryptedContent, contentDecipher.final()]);

    if (!mail.isRead) {
      await this.prisma.mail.update({ where: { id: mailId }, data: { isRead: true } });
    }

    const formattedAttachments = mail.attachments.map(att => ({
      id: att.id,
      filename: att.filename,
      mimetype: att.mimetype,
      size: att.size
    }));

    const { storageKey, encryptedMailKey, mailKeyIv, attachments, ...safeMailData } = mail;

    return { 
      ...safeMailData, 
      content: decryptedContent.toString('utf8'),
      attachments: formattedAttachments
    };
  }


  async downloadAttachment(userId: string, mailId: string, attachmentId: string) {
    // get user, mail and the attachement
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const mail = await this.prisma.mail.findUnique({
      where: { id: mailId },
      include: { attachments: { where: { id: attachmentId } } }
    });

    if (!user || !mail || mail.userId !== userId || mail.attachments.length === 0) {
      throw new NotFoundException('Attachment not found or access denied');
    }

    const attachment = mail.attachments[0];

    // get keys
    const rawMasterKeyHex = await this.redis.get(`masterkey:${userId}`);
    if (!rawMasterKeyHex) throw new UnauthorizedException('MasterKey not found in cache. Please re-login.');
    const rawMasterKey = Buffer.from(rawMasterKeyHex, 'hex');

    const privDecipher = createDecipheriv('aes-256-cbc', rawMasterKey, Buffer.from(user.privateKeyIv, 'hex'));
    let privateKeyPem = privDecipher.update(Buffer.from(user.encryptedPrivateKey, 'hex'));
    privateKeyPem = Buffer.concat([privateKeyPem, privDecipher.final()]);

    const mailKey = privateDecrypt(
        privateKeyPem.toString('utf8'),
        Buffer.from(mail.encryptedMailKey, 'hex')
    );

    // get encrypted attachement
    const s3Response = await this.s3.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: attachment.storageKey,
    }));
    const encryptedAttBuffer = Buffer.from(await s3Response.Body!.transformToByteArray());

    // decrypt attachement
    const attDecipher = createDecipheriv('aes-256-cbc', mailKey, Buffer.from(mail.mailKeyIv, 'hex'));
    let decryptedAtt = attDecipher.update(encryptedAttBuffer);
    decryptedAtt = Buffer.concat([decryptedAtt, attDecipher.final()]);

    return {
      buffer: decryptedAtt,
      filename: attachment.filename,
      mimetype: attachment.mimetype,
      size: attachment.size
    };
  }


  async deleteMail(userId: string, mailId: string) {
    // load mail + attachements from db
    const mail = await this.prisma.mail.findFirst({ 
      where: { id: mailId, userId },
      include: { attachments: true } 
    });
    
    if (!mail) throw new NotFoundException('Mail not found');

    // collect all s3 keys
    const s3KeysToDelete = [
      mail.storageKey, 
      ...mail.attachments.map(att => att.storageKey)
    ];

    // delete the files from s3/minIO
    await Promise.all(s3KeysToDelete.map(key => 
      this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
        .catch(err => this.logger.error(`Failed to delete S3 object ${key}`, err))
    ));

    // delete from db
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

  // --- BULK ACTIONS ---

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

  async bulkDeleteMails(userId: string, mailIds: string[]) {
    // load mails
    const mails = await this.prisma.mail.findMany({ 
      where: { id: { in: mailIds }, userId },
      include: { attachments: true }
    });
    
    // collect s3 keys
    const s3KeysToDelete: string[] = [];
    for (const mail of mails) {
      s3KeysToDelete.push(mail.storageKey);
      for (const att of mail.attachments) {
        s3KeysToDelete.push(att.storageKey);
      }
    }

    // delete from s3
    await Promise.all(s3KeysToDelete.map(key => 
      this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
        .catch(err => this.logger.error(`Failed to delete S3 object ${key}`, err))
    ));

    // delete from db
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

  async getBlockedSenders(userId: string) {
    const blockedSenders = await this.prisma.blockedSender.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    return {
      blockedSenders,
      totalCount: blockedSenders.length,
    };
  }

  async unblockSender(userId: string, emailToUnblock: string) {
    const email = emailToUnblock.toLowerCase().trim();
    const result = await this.prisma.blockedSender.deleteMany({
      where: { userId, email },
    });

    if (result.count === 0) {
      throw new NotFoundException('Blocked sender not found');
    }

    return {
      success: true,
      unblockedEmail: email,
    };
  }

  async bulkUnblockSenders(userId: string, emailsToUnblock: string[]) {
    const emails = [...new Set(emailsToUnblock.map((email) => email.toLowerCase().trim()))];
    const result = await this.prisma.blockedSender.deleteMany({
      where: {
        userId,
        email: { in: emails },
      },
    });

    return {
      success: true,
      requestedCount: emails.length,
      unblockedCount: result.count,
    };
  }

  // --- INCOMING MAIL ---
  async processIncomingMail(dto: IncomingMailDto) {
    const emailMatch = dto.to.match(/<([^>]+)>/);
    const cleanEmail = emailMatch ? emailMatch[1] : dto.to;
    const username = cleanEmail.split('@')[0].toLowerCase().trim();

    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) return { status: 'ignored', reason: 'User not found' };
    if (user.status !== UserStatus.ACTIVE) {
      return { status: 'ignored', reason: 'User account is not active' };
    }

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
    const contentSize = Buffer.byteLength(mailContent, 'utf8');

    interface PreparedAttachment {
      content: Buffer;
      filename: string;
      mimetype: string;
      size: number;
      storageKey: string;
    }

    const preparedAttachments: PreparedAttachment[] = (parsed.attachments ?? []).map(attachment => ({
      content: attachment.content,
      filename: attachment.filename || 'unknown_file',
      mimetype: attachment.contentType || 'application/octet-stream',
      size: attachment.size || attachment.content.length,
      storageKey: `mail_att_${uuidv4()}.bin`,
    }));

    const incomingMailSize = preparedAttachments.reduce(
      (total, attachment) => total + attachment.size,
      contentSize
    );
    const currentUsage = await this.getUserMailStorageUsed(user.id);
    if (currentUsage + incomingMailSize > this.MAX_MAIL_QUOTA) {
      this.logger.warn(
        `Ignored email for user '${username}' because mailbox quota would be exceeded`,
      );
      return { status: 'ignored', reason: 'Mailbox quota exceeded' };
    }

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

    // attachements
    interface AttachmentData {
      filename: string;
      mimetype: string;
      size: number;
      storageKey: string;
    }
    const attachmentData: AttachmentData[] = [];
    
    if (preparedAttachments.length > 0) {
      for (const attachment of preparedAttachments) {
        const attCipher = createCipheriv('aes-256-cbc', mailKey, mailIv);
        const encryptedAtt = Buffer.concat([attCipher.update(attachment.content), attCipher.final()]);

        await this.s3.send(new PutObjectCommand({
          Bucket: this.bucket,
          Key: attachment.storageKey,
          Body: encryptedAtt,
          ContentType: 'application/octet-stream',
        }));

        attachmentData.push({
          filename: attachment.filename,
          mimetype: attachment.mimetype,
          size: attachment.size,
          storageKey: attachment.storageKey
        });
      }
    }

    const encryptedMailKey = publicEncrypt(user.publicKey, mailKey).toString('hex');

    const mail = await this.prisma.mail.create({
      data: {
        from: dto.from,
        to: dto.to,
        subject: parsed.subject || dto.subject || '(No subject)',
        storageKey: storageKey,
        userId: user.id,
        encryptedMailKey: encryptedMailKey,
        mailKeyIv: mailIv.toString('hex'),
        contentSize,
        
        attachments: {
          create: attachmentData
        }
      }
    });

    this.logger.log(`Email from ${dto.from} for user '${username}' saved (Attachments: ${attachmentData.length})`);
    return { status: 'success', mailId: mail.id };
  }
}
