import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../guard/admin-auth.guard';
import { AdminMailsQueryDto, RecallAdminMailDto, SendAdminMailDto } from '../dto/mails.dto';
import { AdminMailsService } from './admin-mails.service';

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
  getMails(@Query() query: AdminMailsQueryDto) {
    return {
      message: 'Mails fetched successfully',
      result: this.adminMailsService.getMails(query),
    };
  }

  @Post('mails')
  sendMail(@Body() dto: SendAdminMailDto) {
    const result = this.adminMailsService.sendMail(dto);
    return {
      message: result.message,
      result,
    };
  }

  @Post('mails/:mailId/recall')
  recallMail(@Param('mailId') mailId: string, @Body() dto: RecallAdminMailDto) {
    const result = this.adminMailsService.recallMail(mailId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Delete('mails/:mailId')
  deleteMail(@Param('mailId') mailId: string) {
    const result = this.adminMailsService.deleteMail(mailId);
    return {
      message: result.message,
      result,
    };
  }
}
