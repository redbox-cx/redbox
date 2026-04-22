import { Injectable, Logger, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InternalMailTargetType, UserStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { simpleParser } from 'mailparser';
import { IncomingMailDto } from './dto/incoming-mail.dto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { publicEncrypt, privateDecrypt, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { MailEventsService, type MailPushEventType } from './mail-events.service';
import { createRequiredS3Client, requireBucket } from 'src/common/storage/s3-client';


type MailboxUser = {
  id: string;
  publicKey: string;
  username?: string;
};

type MailboxAttachmentInput = {
  content: Buffer;
  filename: string;
  mimetype: string;
  size: number;
  storageKey?: string;
};

type StoredMailboxMailInput = {
  from: string;
  to: string;
  subject: string;
  content: string;
  attachments?: MailboxAttachmentInput[];
};

type SharedInternalAttachmentInput = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

const ADMIN_INCOMING_MAIL_ALIASES = new Set([
  'admin@redbox.cx',
  'support@redbox.cx',
  'contact@redbox.cx',
  'no-reply@redbox.cx',
  'help@redbox.cx',
  'team@redbox.cx',
  'moderation@redbox.cx',
  'about@redbox.cx',
]);

@Injectable()
export class MailService {

  private readonly logger = new Logger(MailService.name);
  private readonly MAX_MAIL_QUOTA = 500 * 1024 * 1024; // 500MB
  private readonly s3: S3Client;
  private readonly bucket = requireBucket('S3_BUCKET_MAILS');

  constructor(
    private prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly mailEventsService: MailEventsService,
  ){
    this.s3 = createRequiredS3Client();
  }

  async createInternalInboxMail(
    user: MailboxUser & { username: string },
    input: {
      from: string;
      subject: string;
      body: string;
    },
  ) {
    const mail = await this.storeMailboxMailForUser(user, {
      from: input.from,
      to: `${user.username}@redbox.cx`,
      subject: input.subject,
      content: input.body,
      attachments: [],
    });

    void this.mailEventsService.emitToUser(user.id, {
      type: 'mail.created',
      mailId: mail.id,
      source: 'internal',
    });

    return {
      mailId: mail.id,
    };
  }

  async storeSharedInternalAttachment(attachment: SharedInternalAttachmentInput) {
    const storageKey = `internal_mail_att_${uuidv4()}.bin`;

    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      Body: attachment.buffer,
      ContentType: attachment.mimetype || 'application/octet-stream',
    }));

    return {
      name: attachment.originalname || 'attachment',
      size: attachment.size,
      type: attachment.mimetype || 'application/octet-stream',
      storageKey,
    };
  }

  async deleteStorageObjectByKey(storageKey: string) {
    await this.s3
      .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }))
      .catch((error) => {
        this.logger.error(`Failed to delete S3 object ${storageKey}`, error);
      });
  }

  async downloadStorageObjectByKey(storageKey: string) {
    try {
      const response = await this.s3.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      }));

      return Buffer.from(await response.Body!.transformToByteArray());
    } catch (error) {
      if (this.isMissingStorageObjectError(error)) {
        throw new NotFoundException('Stored mail object not found');
      }

      throw error;
    }
  }

  private async getUserMailStorageUsed(userId: string) {
    const [mailAggregation, attachmentAggregation, directInternalAttachmentAggregation] =
      await Promise.all([
        this.prisma.mail.aggregate({
          where: { userId },
          _sum: { contentSize: true },
        }),
        this.prisma.mailAttachment.aggregate({
          where: { mail: { userId } },
          _sum: { size: true },
        }),
        this.prisma.internalMailAttachment.aggregate({
          where: {
            storageKey: { not: null },
            internalMail: {
              targetType: InternalMailTargetType.USER,
              deliveries: {
                some: {
                  userId,
                  mailId: { not: null },
                  recalledAt: null,
                },
              },
            },
          },
          _sum: { size: true },
        }),
      ]);

    return (
      Number(mailAggregation._sum.contentSize ?? 0) +
      Number(attachmentAggregation._sum.size ?? 0) +
      Number(directInternalAttachmentAggregation._sum.size ?? 0)
    );
  }

  async deleteMailRecordById(
    mailId: string,
    options: {
      throwIfMissing?: boolean;
      eventType?: Extract<MailPushEventType, 'mail.deleted' | 'mail.recalled'>;
      reason?: string;
    } = {},
  ) {
    const throwIfMissing = options.throwIfMissing ?? true;
    const mail = await this.prisma.mail.findUnique({
      where: { id: mailId },
      include: { attachments: true },
    });

    if (!mail) {
      if (throwIfMissing) {
        throw new NotFoundException('Mail not found');
      }

      return { success: true, deleted: false };
    }

    const s3KeysToDelete = [
      mail.storageKey,
      ...mail.attachments.map((attachment) => attachment.storageKey),
    ];

    await Promise.all(
      s3KeysToDelete.map((key) =>
        this.s3
          .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
          .catch((error) => {
            this.logger.error(`Failed to delete S3 object ${key}`, error);
          }),
      ),
    );

    await this.prisma.mail.delete({ where: { id: mailId } });

    void this.mailEventsService.emitToUser(mail.userId, {
      type: options.eventType ?? 'mail.deleted',
      mailId,
      source: options.eventType === 'mail.recalled' ? 'admin' : 'user',
      reason: options.reason,
    });

    return {
      success: true,
      deleted: true,
    };
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
            internalMailDelivery: {
              select: {
                internalMail: {
                  select: {
                    attachments: {
                      where: { storageKey: { not: null } },
                      select: { id: true },
                    },
                  },
                },
              },
            },
            _count: {
              select: { attachments: true}
            }
          }
        }),
        this.prisma.mail.count({ where: whereCondition }),
        this.getUserMailStorageUsed(userId),
      ]);

      const mails = rawMails.map(mail => {
        const { _count, internalMailDelivery, ...rest } = mail;
        const sharedAttachmentCount =
          internalMailDelivery?.internalMail.attachments.length ?? 0;
        const attachmentCount = _count.attachments + sharedAttachmentCount;

        return {
          ...rest,
          attachmentCount,
          hasAttachments: attachmentCount > 0       // true / false
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
      include: {
        attachments: true,
        internalMailDelivery: {
          include: {
            internalMail: {
              include: {
                attachments: {
                  where: { storageKey: { not: null } },
                },
              },
            },
          },
        },
      },
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
      void this.mailEventsService.emitToUser(userId, {
        type: 'mail.updated',
        mailId,
        isRead: true,
        source: 'user',
      });
    }

    const formattedAttachments = mail.attachments.map(att => ({
      id: att.id,
      filename: att.filename,
      mimetype: att.mimetype,
      size: att.size
    }));
    const formattedSharedAttachments =
      mail.internalMailDelivery?.internalMail.attachments.map(att => ({
        id: att.id,
        filename: att.name,
        mimetype: att.type,
        size: att.size,
        isSharedInternal: true,
      })) ?? [];

    const { storageKey, encryptedMailKey, mailKeyIv, attachments, internalMailDelivery, ...safeMailData } = mail;

    return { 
      ...safeMailData, 
      content: decryptedContent.toString('utf8'),
      attachments: [...formattedAttachments, ...formattedSharedAttachments]
    };
  }


  async downloadAttachment(userId: string, mailId: string, attachmentId: string) {
    // get user, mail and the attachement
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const mail = await this.prisma.mail.findUnique({
      where: { id: mailId },
      include: {
        attachments: { where: { id: attachmentId } },
        internalMailDelivery: {
          include: {
            internalMail: {
              include: {
                attachments: {
                  where: {
                    id: attachmentId,
                    storageKey: { not: null },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !mail || mail.userId !== userId) {
      throw new NotFoundException('Attachment not found or access denied');
    }

    const attachment = mail.attachments[0];
    const sharedAttachment = mail.internalMailDelivery?.internalMail.attachments[0];

    if (!attachment && sharedAttachment?.storageKey) {
      const sharedAttachmentBuffer = await this.downloadStorageObjectByKey(
        sharedAttachment.storageKey,
      );

      return {
        buffer: sharedAttachmentBuffer,
        filename: sharedAttachment.name,
        mimetype: sharedAttachment.type,
        size: sharedAttachment.size
      };
    }

    if (!attachment) {
      throw new NotFoundException('Attachment not found or access denied');
    }

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
    const encryptedAttBuffer = await this.downloadStorageObjectByKey(attachment.storageKey);

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
    return this.deleteMailRecordById(mail.id);
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

    void this.mailEventsService.emitToUser(userId, {
      type: 'mail.updated',
      mailId,
      folder,
      source: 'user',
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

    void this.mailEventsService.emitToUser(userId, {
      type: 'mail.bulk-updated',
      mailIds,
      folder,
      count: result.count,
      source: 'user',
    });

    return { movedCount: result.count, folder };
  }

  async setReadStatus(userId: string, mailId: string, isRead: boolean) {
    const mail = await this.prisma.mail.findFirst({ where: { id: mailId, userId } });
    if (!mail) throw new NotFoundException('Mail not found');
    await this.prisma.mail.update({ where: { id: mailId }, data: { isRead } });
    void this.mailEventsService.emitToUser(userId, {
      type: 'mail.updated',
      mailId,
      isRead,
      source: 'user',
    });
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
    void this.mailEventsService.emitToUser(userId, {
      type: 'mail.bulk-deleted',
      mailIds,
      count: result.count,
      source: 'user',
    });
    return { deletedCount: result.count };
  }

  async bulkArchiveMails(userId: string, mailIds: string[]) {
    const result = await this.prisma.mail.updateMany({
      where: { id: { in: mailIds }, userId },
      data: { isArchived: true }
    });
    void this.mailEventsService.emitToUser(userId, {
      type: 'mail.bulk-updated',
      mailIds,
      folder: 'archive',
      count: result.count,
      source: 'user',
    });
    return { archivedCount: result.count };
  }

  async bulkSetReadStatus(userId: string, mailIds: string[], isRead: boolean) {
    const result = await this.prisma.mail.updateMany({
      where: { id: { in: mailIds }, userId },
      data: { isRead }
    });
    void this.mailEventsService.emitToUser(userId, {
      type: 'mail.bulk-updated',
      mailIds,
      isRead,
      count: result.count,
      source: 'user',
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
    const cleanEmail = (emailMatch ? emailMatch[1] : dto.to).toLowerCase().trim();
    const username = this.resolveIncomingMailboxUsername(cleanEmail);

    if (username.includes('*')) {
      this.logger.warn(`Ignored external mail with broadcast recipient: ${cleanEmail}`);
      return {
        status: 'ignored',
        reason: 'Broadcast delivery is only supported for internal admin mail',
      };
    }

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

    const preparedAttachments: MailboxAttachmentInput[] = (parsed.attachments ?? []).map(attachment => ({
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

    const mail = await this.storeMailboxMailForUser(user, {
      from: dto.from,
      to: dto.to,
      subject: parsed.subject || dto.subject || '(No subject)',
      content: mailContent,
      attachments: preparedAttachments,
    });

    void this.mailEventsService.emitToUser(user.id, {
      type: 'mail.created',
      mailId: mail.id,
      source: 'external',
    });

    this.logger.log(
      `Email from ${dto.from} for user '${username}' saved (Recipient: ${cleanEmail}, Attachments: ${preparedAttachments.length})`,
    );
    return { status: 'success', mailId: mail.id };
  }

  private resolveIncomingMailboxUsername(cleanEmail: string) {
    if (ADMIN_INCOMING_MAIL_ALIASES.has(cleanEmail)) {
      return 'admin';
    }

    return cleanEmail.split('@')[0].toLowerCase().trim();
  }

  private async storeMailboxMailForUser(user: MailboxUser, input: StoredMailboxMailInput) {
    const storageKey = `mail_${uuidv4()}.bin`;
    const attachments = input.attachments ?? [];
    const contentSize = Buffer.byteLength(input.content, 'utf8');

    const mailKey = randomBytes(32);
    const mailIv = randomBytes(16);

    const cipher = createCipheriv('aes-256-cbc', mailKey, mailIv);
    const encryptedContent = Buffer.concat([cipher.update(input.content, 'utf8'), cipher.final()]);

    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      Body: encryptedContent,
      ContentType: 'application/octet-stream',
    }));

    const attachmentData: Array<{
      filename: string;
      mimetype: string;
      size: number;
      storageKey: string;
    }> = [];

    if (attachments.length > 0) {
      for (const attachment of attachments) {
        const attachmentStorageKey = attachment.storageKey || `mail_att_${uuidv4()}.bin`;
        const attCipher = createCipheriv('aes-256-cbc', mailKey, mailIv);
        const encryptedAttachment = Buffer.concat([
          attCipher.update(attachment.content),
          attCipher.final(),
        ]);

        await this.s3.send(new PutObjectCommand({
          Bucket: this.bucket,
          Key: attachmentStorageKey,
          Body: encryptedAttachment,
          ContentType: 'application/octet-stream',
        }));

        attachmentData.push({
          filename: attachment.filename,
          mimetype: attachment.mimetype,
          size: attachment.size,
          storageKey: attachmentStorageKey,
        });
      }
    }

    const encryptedMailKey = publicEncrypt(user.publicKey, mailKey).toString('hex');

    return this.prisma.mail.create({
      data: {
        from: input.from,
        to: input.to,
        subject: input.subject,
        storageKey,
        userId: user.id,
        encryptedMailKey,
        mailKeyIv: mailIv.toString('hex'),
        contentSize,
        attachments: {
          create: attachmentData,
        },
      },
    });
  }

  private isMissingStorageObjectError(error: unknown) {
    const s3Error = error as {
      Code?: string;
      name?: string;
      $metadata?: {
        httpStatusCode?: number;
      };
    };

    return (
      s3Error.Code === 'NoSuchKey' ||
      s3Error.name === 'NoSuchKey' ||
      s3Error.$metadata?.httpStatusCode === 404
    );
  }
}
