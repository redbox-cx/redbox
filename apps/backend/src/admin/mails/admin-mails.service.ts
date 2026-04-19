import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ADMIN_MAIL_SENDERS,
  ADMIN_MAIL_TEMPLATES,
  ADMIN_MAILS,
  type AdminMailRecord,
} from '../admin.data';
import { AdminMailsQueryDto, RecallAdminMailDto, SendAdminMailDto } from '../dto/mails.dto';

function clone<T>(value: T): T {
  return structuredClone(value);
}

@Injectable()
export class AdminMailsService {
  private mails: AdminMailRecord[] = clone(ADMIN_MAILS);

  getMailSenders() {
    return clone(ADMIN_MAIL_SENDERS);
  }

  getMailTemplates() {
    return clone(ADMIN_MAIL_TEMPLATES);
  }

  getMails(query: AdminMailsQueryDto) {
    let items = [...this.mails];

    if (query.senderId) {
      items = items.filter((mail) => mail.sender.id === query.senderId);
    }

    if (query.search) {
      const searchValue = query.search.toLowerCase();
      items = items.filter(
        (mail) =>
          mail.subject.toLowerCase().includes(searchValue) ||
          mail.body.toLowerCase().includes(searchValue) ||
          mail.recipients.some((recipient) => recipient.toLowerCase().includes(searchValue)),
      );
    }

    if (query.isBroadcast !== undefined) {
      items = items.filter((mail) => mail.isBroadcast === query.isBroadcast);
    }

    const paginatedItems = items.slice(query.offset, query.offset + query.limit);

    return {
      items: clone(paginatedItems),
      pagination: {
        limit: query.limit,
        offset: query.offset,
        returned: paginatedItems.length,
        hasMore: query.offset + paginatedItems.length < items.length,
      },
    };
  }

  sendMail(dto: SendAdminMailDto) {
    const sender = ADMIN_MAIL_SENDERS.find((entry) => entry.id === dto.senderId);
    if (!sender) {
      throw new NotFoundException('Sender not found');
    }

    if (!dto.isBroadcast && dto.recipients.length === 0) {
      throw new BadRequestException('At least one recipient is required when isBroadcast is false');
    }

    const mailId = `mail_${Date.now()}`;
    this.mails.unshift({
      id: mailId,
      sender,
      recipients: dto.recipients,
      isBroadcast: dto.isBroadcast,
      subject: dto.subject,
      body: dto.body,
      isHtml: dto.isHtml,
      template: dto.template ?? null,
      attachments: dto.attachments,
      sentAt: new Date().toISOString(),
      canRecall: true,
      recalledAt: null,
    });

    return {
      success: true,
      message: 'Mail sent successfully',
      mailId,
    };
  }

  recallMail(mailId: string, dto: RecallAdminMailDto) {
    const mail = this.findMailOrThrow(mailId);
    mail.canRecall = false;
    mail.recalledAt = new Date().toISOString();
    void dto;

    return {
      success: true,
      message: 'Mail recalled successfully',
    };
  }

  deleteMail(mailId: string) {
    this.findMailOrThrow(mailId);
    this.mails = this.mails.filter((entry) => entry.id !== mailId);

    return {
      success: true,
      message: 'Mail deleted/recalled successfully',
    };
  }

  private findMailOrThrow(mailId: string) {
    const mail = this.mails.find((entry) => entry.id === mailId);
    if (!mail) {
      throw new NotFoundException('Mail not found');
    }

    return mail;
  }
}
