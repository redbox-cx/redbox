import { Controller, Post, Get, Body, Req, UnauthorizedException, UseGuards, UseInterceptors, Query, Param, Patch, Delete } from '@nestjs/common';
import { MailService } from './mail.service';
import { IncomingMailDto } from './dto/incoming-mail.dto';
import type { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guard/auth.guard';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';
import { timingSafeEqual } from 'crypto';
import { BulkMailDto, MarkReadDto, BulkMarkReadDto, BlockSenderDto, MoveMailDto, BulkMoveMailDto } from './dto/mail-actions.dto';

@Controller('mail')
@UseInterceptors(TransformInterceptor)
export class MailController {
  constructor(private readonly mailService: MailService) {}


  @Get()
  @UseGuards(JwtAuthGuard)
  async listMyMails(
    @GetUserId() userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sort') sort?: string,   // 'newest', 'oldest', 'unread', 'read'
    @Query('folder') folder?: string // 'inbox', 'archive', 'spam', 'all'
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    const safeLimit = parsedLimit > 100 ? 100 : parsedLimit;
    
    const sortMethod = sort || 'newest';
    const folderMethod = folder || 'inbox';

    const data = await this.mailService.getUserMails(
      userId, 
      safeLimit, 
      parsedOffset, 
      sortMethod, 
      folderMethod
    );
    
    return { message: 'Mails fetched successfully', result: data };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getSingleMail(
    @GetUserId() userId: string,
    @Param('id') mailId: string
  ) {
    const mail = await this.mailService.getSingleMail(userId, mailId);
    return { message: 'Mail fetched successfully', result: mail };
  }


  // --- SINGLE ACTIONS ---

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteMail(@GetUserId() userId: string, @Param('id') mailId: string) {
    await this.mailService.deleteMail(userId, mailId);
    return { message: 'Mail deleted successfully' };
  }

  @Patch(':id/read-status')
  @UseGuards(JwtAuthGuard)
  async updateReadStatus(@GetUserId() userId: string, @Param('id') mailId: string, @Body() dto: MarkReadDto) {
    await this.mailService.setReadStatus(userId, mailId, dto.isRead);
    return { message: `Mail marked as ${dto.isRead ? 'read' : 'unread'}` };
  }

  @Patch(':id/move')
  @UseGuards(JwtAuthGuard)
  async moveMail(@GetUserId() userId: string, @Param('id') mailId: string, @Body() dto: MoveMailDto) {
    const result = await this.mailService.moveMail(userId, mailId, dto.folder);
    return { message: `Mail moved to ${dto.folder} successfully`, result };
  }

  // --- BULK ACTIONS ---

  @Post('bulk/delete')
  @UseGuards(JwtAuthGuard)
  async bulkDelete(@GetUserId() userId: string, @Body() dto: BulkMailDto) {
    const result = await this.mailService.bulkDeleteMails(userId, dto.mailIds);
    return { message: 'Mails deleted successfully', result };
  }

  @Post('bulk/read-status')
  @UseGuards(JwtAuthGuard)
  async bulkReadStatus(@GetUserId() userId: string, @Body() dto: BulkMarkReadDto) {
    const result = await this.mailService.bulkSetReadStatus(userId, dto.mailIds, dto.isRead);
    return { message: `Mails marked as ${dto.isRead ? 'read' : 'unread'}`, result };
  }

  @Post('bulk/move')
  @UseGuards(JwtAuthGuard)
  async bulkMove(@GetUserId() userId: string, @Body() dto: BulkMoveMailDto) {
    const result = await this.mailService.bulkMoveMails(userId, dto.mailIds, dto.folder);
    return { message: `Mails moved to ${dto.folder} successfully`, result };
  }

  // --- SENDER BLOCKING ---

  @Post('block-sender')
  @UseGuards(JwtAuthGuard)
  async blockSender(@GetUserId() userId: string, @Body() dto: BlockSenderDto) {
    const result = await this.mailService.blockSender(userId, dto.email);
    return { message: 'Sender blocked successfully', result };
  }


  // --- INCOMING WEBHOOK ---
  // using timingSafeEqual to prevent attackers from guessing the passphrase with respondtime
  @Post('incoming')
  async receiveMail(@Req() req: Request, @Body() dto: IncomingMailDto) {
    
    const webhookSecret = req.headers['x-redbox-webhook-secret'];
    
    if (!webhookSecret || typeof webhookSecret !== 'string') {
      throw new UnauthorizedException('Missing Webhook Secret');
    }

    const secretBuffer = Buffer.from(process.env.MAIL_WEBHOOK_SECRET || '');
    const inputBuffer = Buffer.from(webhookSecret);

    if (secretBuffer.length !== inputBuffer.length || !timingSafeEqual(secretBuffer, inputBuffer)) {
      throw new UnauthorizedException('Invalid Webhook Secret');
    }

    const result = await this.mailService.processIncomingMail(dto);
    
    return {
      message: 'Webhook received successfully',
      result
    };
  }
}