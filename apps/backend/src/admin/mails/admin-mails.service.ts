import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, InternalMailTargetType, Prisma, UserStatus } from '@prisma/client';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from 'src/prisma.service';
import {
  ADMIN_MAIL_SENDERS,
  ADMIN_MAIL_TEMPLATES,
  type AdminMailRecord,
  type AdminMailSender,
} from '../admin.data';
import { AdminMailsQueryDto, RecallAdminMailDto, SendAdminMailDto } from '../dto/mails.dto';

type InternalMailRecipientUser = {
  id: string;
  username: string;
  publicKey: string;
};

type StoredInternalMailAttachment = {
  name: string;
  size: number;
  type: string;
  storageKey: string;
};

const MAX_INTERNAL_MAIL_ATTACHMENTS = 10;
const MAX_INTERNAL_MAIL_ATTACHMENT_SIZE = 35 * 1024 * 1024;

function clone<T>(value: T): T {
  return structuredClone(value);
}

@Injectable()
export class AdminMailsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly mailService: MailService,
  ) {}

  getMailSenders() {
    return clone(ADMIN_MAIL_SENDERS);
  }

  getMailTemplates() {
    return clone(ADMIN_MAIL_TEMPLATES);
  }

  async getMails(query: AdminMailsQueryDto) {
    const where: Prisma.InternalMailWhereInput = {
      deletedAt: null,
    };

    if (query.senderId) {
      where.senderId = query.senderId;
    }

    if (query.search) {
      const searchValue = query.search.trim();
      where.OR = [
        { subject: { contains: searchValue } },
        { body: { contains: searchValue } },
        { toAddress: { contains: searchValue } },
        { senderLabel: { contains: searchValue } },
      ];
    }

    if (query.isBroadcast !== undefined) {
      where.targetType = query.isBroadcast
        ? InternalMailTargetType.BROADCAST
        : InternalMailTargetType.USER;
    }

    const [items, total] = await Promise.all([
      this.prismaService.internalMail.findMany({
        where,
        include: {
          attachments: {
            orderBy: { createdAt: 'asc' },
          },
          deliveries: true,
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prismaService.internalMail.count({ where }),
    ]);

    const mappedItems = items.map((mail) => this.toAdminMailRecord(mail));

    return {
      items: mappedItems,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        returned: mappedItems.length,
        hasMore: query.offset + mappedItems.length < total,
        total,
      },
    };
  }

  async sendMail(
    adminUserId: string,
    dto: SendAdminMailDto,
    uploadedAttachments: Express.Multer.File[] = [],
  ) {
    const sender = this.findSenderOrThrow(dto.senderId);
    const target = this.resolveTargetAddress(dto);
    const recipientUsers = await this.resolveRecipientUsers(target);

    if (recipientUsers.length === 0) {
      throw new BadRequestException('No recipients available for this internal mail');
    }

    const storedUploadedAttachments =
      await this.storeUploadedAttachments(uploadedAttachments);
    const deliveredMailIds: string[] = [];
    let internalMailId: string | null = null;

    const metadataAttachments = dto.attachments ?? [];
    const attachmentCreateData = [
      ...metadataAttachments.map((attachment) => ({
        name: attachment.name,
        size: attachment.size,
        type: attachment.type,
      })),
      ...storedUploadedAttachments.map((attachment) => ({
        name: attachment.name,
        size: attachment.size,
        type: attachment.type,
        storageKey: attachment.storageKey,
      })),
    ];

    try {
      const internalMail = await this.prismaService.internalMail.create({
        data: {
          createdByAdminUserId: adminUserId,
          senderId: sender.id,
          senderAddress: sender.address,
          senderLabel: sender.label,
          toAddress: target.toAddress,
          targetType: target.targetType,
          targetUsername: target.targetUsername,
          subject: dto.subject,
          body: dto.body,
          isHtml: dto.isHtml,
          template: dto.template ?? null,
          attachments: {
            create: attachmentCreateData,
          },
        },
        include: {
          attachments: true,
          deliveries: true,
        },
      });
      internalMailId = internalMail.id;

      try {
        for (const user of recipientUsers) {
          const inboxMail = await this.mailService.createInternalInboxMail(user, {
            from: this.buildSenderHeader(sender),
            subject: dto.subject,
            body: dto.body,
          });

          deliveredMailIds.push(inboxMail.mailId);

          await this.prismaService.internalMailDelivery.create({
            data: {
              internalMailId: internalMail.id,
              userId: user.id,
              mailId: inboxMail.mailId,
            },
          });
        }
      } catch (error) {
        for (const mailId of deliveredMailIds) {
          await this.mailService.deleteMailRecordById(mailId, { throwIfMissing: false });
        }

        await this.prismaService.internalMail
          .delete({ where: { id: internalMail.id } })
          .catch(() => undefined);

        throw error;
      }

      await this.createAuditLog(this.prismaService, {
        adminUserId,
        action: 'internal_mail_sent',
        reason: `Internal mail sent to ${target.toAddress}`,
        meta: {
          internalMailId: internalMail.id,
          toAddress: target.toAddress,
          targetType: target.targetType.toLowerCase(),
          recipientCount: recipientUsers.length,
          attachmentCount: attachmentCreateData.length,
          sharedAttachmentCount: storedUploadedAttachments.length,
        },
      });

      return {
        success: true,
        message: 'Mail sent successfully',
        mailId: internalMail.id,
        toAddress: target.toAddress,
        recipientCount: recipientUsers.length,
        attachmentCount: attachmentCreateData.length,
        sharedAttachmentCount: storedUploadedAttachments.length,
        isBroadcast: target.targetType === InternalMailTargetType.BROADCAST,
      };
    } catch (error) {
      for (const mailId of deliveredMailIds) {
        await this.mailService.deleteMailRecordById(mailId, { throwIfMissing: false });
      }

      await this.deleteStoredAttachments(storedUploadedAttachments);

      if (internalMailId) {
        await this.prismaService.internalMail
          .delete({ where: { id: internalMailId } })
          .catch(() => undefined);
      }

      throw error;
    }
  }

  async recallMail(adminUserId: string, mailId: string, dto: RecallAdminMailDto) {
    const mail = await this.findInternalMailOrThrow(mailId);

    if (mail.deletedAt) {
      throw new BadRequestException('Mail has already been deleted');
    }

    if (mail.recalledAt) {
      throw new BadRequestException('Mail has already been recalled');
    }

    const recalledCount = await this.recallDeliveredInboxCopies(mail.id);
    const recalledAt = new Date();

    await this.prismaService.$transaction(async (prisma) => {
      await prisma.internalMail.update({
        where: { id: mail.id },
        data: {
          recalledAt,
          recallReason: dto.reason,
          recalledByAdminUserId: adminUserId,
        },
      });

      await prisma.internalMailDelivery.updateMany({
        where: {
          internalMailId: mail.id,
          recalledAt: null,
        },
        data: {
          recalledAt,
        },
      });

      await this.createAuditLog(prisma, {
        adminUserId,
        action: 'internal_mail_recalled',
        reason: dto.reason,
        meta: {
          internalMailId: mail.id,
          toAddress: mail.toAddress,
          targetType: mail.targetType.toLowerCase(),
          recalledCount,
        },
      });
    });

    return {
      success: true,
      message: 'Mail recalled successfully',
      recalledCount,
    };
  }

  async deleteMail(adminUserId: string, mailId: string) {
    const mail = await this.findInternalMailOrThrow(mailId);

    if (mail.deletedAt) {
      throw new BadRequestException('Mail has already been deleted');
    }

    const deletedAt = new Date();
    const deleteReason = 'Deleted by admin';
    let recalledCount = 0;

    if (!mail.recalledAt) {
      recalledCount = await this.recallDeliveredInboxCopies(mail.id);
    }

    await this.prismaService.$transaction(async (prisma) => {
      await prisma.internalMail.update({
        where: { id: mail.id },
        data: {
          deletedAt,
          deleteReason,
          deletedByAdminUserId: adminUserId,
          ...(mail.recalledAt
            ? {}
            : {
                recalledAt: deletedAt,
                recallReason: deleteReason,
                recalledByAdminUserId: adminUserId,
              }),
        },
      });

      if (!mail.recalledAt) {
        await prisma.internalMailDelivery.updateMany({
          where: {
            internalMailId: mail.id,
            recalledAt: null,
          },
          data: {
            recalledAt: deletedAt,
          },
        });
      }

      await this.createAuditLog(prisma, {
        adminUserId,
        action: 'internal_mail_deleted',
        reason: deleteReason,
        meta: {
          internalMailId: mail.id,
          toAddress: mail.toAddress,
          targetType: mail.targetType.toLowerCase(),
          recalledCount,
        },
      });
    });

    await this.deleteSharedAttachmentObjects(mail.id);

    return {
      success: true,
      message: 'Mail deleted/recalled successfully',
      recalledCount,
    };
  }

  private findSenderOrThrow(senderId: string) {
    const sender = ADMIN_MAIL_SENDERS.find((entry) => entry.id === senderId);

    if (!sender) {
      throw new NotFoundException('Sender not found');
    }

    return sender;
  }

  private resolveTargetAddress(dto: SendAdminMailDto) {
    const normalizedTo = dto.to?.trim().toLowerCase();
    const normalizedRecipients = (dto.recipients ?? [])
      .map((recipient) => recipient.trim().toLowerCase())
      .filter(Boolean);

    const toAddress =
      normalizedTo ||
      (dto.isBroadcast
        ? '*@redbox.cx'
        : normalizedRecipients.length === 1
          ? normalizedRecipients[0]
          : null);

    if (!toAddress) {
      throw new BadRequestException(
        'Internal mail requires either to, one legacy recipient, or broadcast mode',
      );
    }

    if (normalizedRecipients.length > 1) {
      throw new BadRequestException(
        'Internal mail can only target one specific user or *@redbox.cx broadcast',
      );
    }

    if (!/^(?:\*|[^@\s]+)@redbox\.cx$/i.test(toAddress)) {
      throw new BadRequestException(
        'Internal mail can only be sent to *@redbox.cx or username@redbox.cx',
      );
    }

    const localPart = toAddress.split('@')[0]!.toLowerCase();

    return {
      toAddress,
      targetType:
        localPart === '*'
          ? InternalMailTargetType.BROADCAST
          : InternalMailTargetType.USER,
      targetUsername: localPart === '*' ? null : localPart,
    };
  }

  private async resolveRecipientUsers(target: {
    targetType: InternalMailTargetType;
    targetUsername: string | null;
  }): Promise<InternalMailRecipientUser[]> {
    if (target.targetType === InternalMailTargetType.BROADCAST) {
      return this.prismaService.user.findMany({
        where: {
          status: { not: UserStatus.DELETED },
        },
        select: {
          id: true,
          username: true,
          publicKey: true,
        },
        orderBy: { createdAt: 'asc' },
      });
    }

    const user = await this.prismaService.user.findFirst({
      where: {
        username: target.targetUsername!,
        status: { not: UserStatus.DELETED },
      },
      select: {
        id: true,
        username: true,
        publicKey: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Recipient user not found');
    }

    return [user];
  }

  private async findInternalMailOrThrow(mailId: string) {
    const mail = await this.prismaService.internalMail.findUnique({
      where: { id: mailId },
      include: {
        attachments: true,
        deliveries: true,
      },
    });

    if (!mail) {
      throw new NotFoundException('Mail not found');
    }

    return mail;
  }

  private async recallDeliveredInboxCopies(internalMailId: string) {
    const deliveries = await this.prismaService.internalMailDelivery.findMany({
      where: {
        internalMailId,
        mailId: { not: null },
      },
      select: {
        mailId: true,
      },
    });

    let recalledCount = 0;

    for (const delivery of deliveries) {
      if (!delivery.mailId) {
        continue;
      }

      await this.mailService.deleteMailRecordById(delivery.mailId, {
        throwIfMissing: false,
        eventType: 'mail.recalled',
        reason: 'Internal mail recalled by admin',
      });
      recalledCount += 1;
    }

    return recalledCount;
  }

  private async storeUploadedAttachments(
    uploadedAttachments: Express.Multer.File[],
  ): Promise<StoredInternalMailAttachment[]> {
    if (uploadedAttachments.length > MAX_INTERNAL_MAIL_ATTACHMENTS) {
      throw new BadRequestException(
        `Internal mail can't have more than ${MAX_INTERNAL_MAIL_ATTACHMENTS} attachments`,
      );
    }

    const storedAttachments: StoredInternalMailAttachment[] = [];

    try {
      for (const attachment of uploadedAttachments) {
        if (attachment.size > MAX_INTERNAL_MAIL_ATTACHMENT_SIZE) {
          throw new BadRequestException("Attachment can't be larger than 35MB");
        }

        storedAttachments.push(
          await this.mailService.storeSharedInternalAttachment(attachment),
        );
      }

      return storedAttachments;
    } catch (error) {
      await this.deleteStoredAttachments(storedAttachments);
      throw error;
    }
  }

  private async deleteStoredAttachments(attachments: StoredInternalMailAttachment[]) {
    await Promise.all(
      attachments.map((attachment) =>
        this.mailService.deleteStorageObjectByKey(attachment.storageKey),
      ),
    );
  }

  private async deleteSharedAttachmentObjects(internalMailId: string) {
    const attachments = await this.prismaService.internalMailAttachment.findMany({
      where: {
        internalMailId,
        storageKey: { not: null },
      },
      select: {
        storageKey: true,
      },
    });

    await Promise.all(
      attachments.map((attachment) =>
        attachment.storageKey
          ? this.mailService.deleteStorageObjectByKey(attachment.storageKey)
          : Promise.resolve(),
      ),
    );
  }

  async downloadAttachment(mailId: string, attachmentId: string) {
    const attachment = await this.prismaService.internalMailAttachment.findFirst({
      where: {
        id: attachmentId,
        internalMailId: mailId,
        internalMail: {
          deletedAt: null,
        },
      },
      select: {
        name: true,
        size: true,
        type: true,
        storageKey: true,
      },
    });

    if (!attachment?.storageKey) {
      throw new NotFoundException('Attachment not found or not downloadable');
    }

    let buffer: Buffer;
    try {
      buffer = await this.mailService.downloadStorageObjectByKey(attachment.storageKey);
    } catch (error) {
      if (error instanceof NotFoundException) {
        await this.prismaService.internalMailAttachment.updateMany({
          where: {
            id: attachmentId,
            storageKey: attachment.storageKey,
          },
          data: {
            storageKey: null,
          },
        });
      }

      throw error;
    }

    return {
      buffer,
      filename: attachment.name,
      mimetype: attachment.type,
      size: attachment.size,
    };
  }

  private toAdminMailRecord(mail: {
    id: string;
    senderId: string;
    senderAddress: string;
    senderLabel: string;
    toAddress: string;
    targetType: InternalMailTargetType;
    targetUsername: string | null;
    subject: string;
    body: string;
    isHtml: boolean;
    template: string | null;
    createdAt: Date;
    recalledAt: Date | null;
    deletedAt: Date | null;
    attachments: Array<{
      id: string;
      name: string;
      size: number;
      type: string;
      storageKey?: string | null;
    }>;
    deliveries: Array<{
      mailId: string | null;
      recalledAt: Date | null;
    }>;
  }): AdminMailRecord & {
    toAddress: string;
    recipientCount: number;
    activeRecipientCount: number;
    recalledCount: number;
    deletedAt: string | null;
    targetType: 'broadcast' | 'user';
    targetUsername: string | null;
  } {
    const sender = this.toAdminMailSender(mail.senderId, mail.senderAddress, mail.senderLabel);
    const recipientCount = mail.deliveries.length;
    const recalledCount = mail.deliveries.filter((delivery) => delivery.recalledAt !== null).length;
    const activeRecipientCount = mail.deliveries.filter(
      (delivery) => delivery.recalledAt === null && delivery.mailId !== null,
    ).length;

    return {
      id: mail.id,
      sender,
      recipients: [mail.toAddress],
      isBroadcast: mail.targetType === InternalMailTargetType.BROADCAST,
      subject: mail.subject,
      body: mail.body,
      isHtml: mail.isHtml,
      template: mail.template,
      attachments: mail.attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        size: attachment.size,
        type: attachment.type,
        downloadUrl: attachment.storageKey
          ? `/admin/mails/${mail.id}/attachments/${attachment.id}`
          : null,
        isDownloadable: Boolean(attachment.storageKey),
      })),
      sentAt: mail.createdAt.toISOString(),
      canRecall: mail.recalledAt === null && mail.deletedAt === null,
      recalledAt: mail.recalledAt?.toISOString() ?? null,
      toAddress: mail.toAddress,
      recipientCount,
      activeRecipientCount,
      recalledCount,
      deletedAt: mail.deletedAt?.toISOString() ?? null,
      targetType:
        mail.targetType === InternalMailTargetType.BROADCAST
          ? 'broadcast'
          : 'user',
      targetUsername: mail.targetUsername,
    };
  }

  private toAdminMailSender(
    senderId: string,
    senderAddress: string,
    senderLabel: string,
  ): AdminMailSender {
    const knownSender = ADMIN_MAIL_SENDERS.find((entry) => entry.id === senderId);

    if (knownSender) {
      return clone(knownSender);
    }

    const initials = senderLabel
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0]!.toUpperCase())
      .join('')
      .slice(0, 2) || 'IN';

    return {
      id: senderId,
      address: senderAddress,
      label: senderLabel,
      initials,
      color: '#951d2a',
    };
  }

  private buildSenderHeader(sender: AdminMailSender) {
    return `${sender.label} <${sender.address}>`;
  }

  private async createAuditLog(
    prisma: Prisma.TransactionClient | PrismaService,
    params: {
      adminUserId: string;
      action: string;
      reason: string;
      meta: Prisma.InputJsonValue;
    },
  ) {
    await prisma.adminAuditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        adminUserId: params.adminUserId,
        action: params.action,
        reason: params.reason,
        meta: params.meta,
      },
    });
  }
}
