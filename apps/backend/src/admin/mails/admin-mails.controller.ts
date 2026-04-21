import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
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
@UseGuards(AdminJwtAuthGuard)
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

  @Post('mails')
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
  async deleteMail(@GetUserId() adminUserId: string, @Param('mailId') mailId: string) {
    const result = await this.adminMailsService.deleteMail(adminUserId, mailId);
    return {
      message: result.message,
      result,
    };
  }
}
