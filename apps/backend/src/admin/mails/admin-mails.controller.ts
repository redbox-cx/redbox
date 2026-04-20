import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
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
  async getMails(@Query() query: AdminMailsQueryDto) {
    return {
      message: 'Mails fetched successfully',
      result: await this.adminMailsService.getMails(query),
    };
  }

  @Post('mails')
  async sendMail(@GetUserId() adminUserId: string, @Body() dto: SendAdminMailDto) {
    const result = await this.adminMailsService.sendMail(adminUserId, dto);
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
