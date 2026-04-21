import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
import { AdminDefaultRateLimit, RateLimit } from 'src/common/rate-limit/rate-limit.decorators';
import { RateLimitGuard } from 'src/common/rate-limit/rate-limit.guard';
import { AdminJwtAuthGuard } from '../guard/admin-auth.guard';
import { AdminMailsQueryDto, RecallAdminMailDto, SendAdminMailDto } from '../dto/mails.dto';
import { AdminMailsService } from './admin-mails.service';

const adminMailAttachmentUploadConfig = {
  storage: memoryStorage(),
  limits: {
    files: 10,
    fileSize: 35 * 1024 * 1024,
  },
};

@Controller('admin')
@AdminDefaultRateLimit()
@UseGuards(AdminJwtAuthGuard, RateLimitGuard)
export class AdminMailsController {
  constructor(private readonly adminMailsService: AdminMailsService) {}

  @Get('mails/senders')
  getMailSenders() {
    return {
      message: 'Mail senders fetched successfully',
      result: this.adminMailsService.getMailSenders(),
    };
  }

  @Get('mails/templates')
  getMailTemplates() {
    return {
      message: 'Mail templates fetched successfully',
      result: this.adminMailsService.getMailTemplates(),
    };
  }

  @Get('mails')
  async getMails(@Query() query: AdminMailsQueryDto) {
    return {
      message: 'Mails fetched successfully',
      result: await this.adminMailsService.getMails(query),
    };
  }

  @Get('mails/:mailId/attachments/:attachmentId')
  async downloadAttachment(
    @Param('mailId') mailId: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const file = await this.adminMailsService.downloadAttachment(mailId, attachmentId);
    const safeFilename = file.filename.replace(/["\\\r\n]/g, '_');

    res.set({
      'Content-Type': file.mimetype,
      'Content-Length': file.buffer.length,
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
    });

    res.send(file.buffer);
  }

  @Post('mails')
  @RateLimit({ name: 'admin:mails:create:admin', limit: 10, windowSeconds: 60 * 60, subject: 'admin' })
  @UseInterceptors(FilesInterceptor('attachments', 10, adminMailAttachmentUploadConfig))
  async sendMail(
    @GetUserId() adminUserId: string,
    @Body() dto: SendAdminMailDto,
    @UploadedFiles() attachments: Express.Multer.File[] = [],
  ) {
    const result = await this.adminMailsService.sendMail(adminUserId, dto, attachments);
    return {
      message: result.message,
      result,
    };
  }

  @Post('mails/:mailId/recall')
  @RateLimit({ name: 'admin:danger:admin', limit: 10, windowSeconds: 10 * 60, subject: 'admin' })
  async recallMail(
    @GetUserId() adminUserId: string,
    @Param('mailId') mailId: string,
    @Body() dto: RecallAdminMailDto,
  ) {
    const result = await this.adminMailsService.recallMail(adminUserId, mailId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Delete('mails/:mailId')
  @RateLimit({ name: 'admin:danger:admin', limit: 10, windowSeconds: 10 * 60, subject: 'admin' })
  async deleteMail(@GetUserId() adminUserId: string, @Param('mailId') mailId: string) {
    const result = await this.adminMailsService.deleteMail(adminUserId, mailId);
    return {
      message: result.message,
      result,
    };
  }
}
