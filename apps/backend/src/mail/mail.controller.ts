import { Controller, Post, Get, Body, Req, Res, UnauthorizedException, UseGuards, UseInterceptors, Query, Param, Patch, Delete, Sse } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailEventsService } from './mail-events.service';
import { IncomingMailDto } from './dto/incoming-mail.dto';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guard/auth.guard';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';
import { timingSafeEqual } from 'crypto';
import { Observable } from 'rxjs';
import { MailSseAuthGuard } from './guard/mail-sse-auth.guard';
import { RateLimit } from 'src/common/rate-limit/rate-limit.decorators';
import { RateLimitGuard } from 'src/common/rate-limit/rate-limit.guard';
import { RateLimitService } from 'src/common/rate-limit/rate-limit.service';
import {
  BulkMailDto,
  MarkReadDto,
  BulkMarkReadDto,
  BlockSenderDto,
  MoveMailDto,
  BulkMoveMailDto,
  BulkUnblockSenderDto,
} from './dto/mail-actions.dto';

@Controller('mail')
@UseInterceptors(TransformInterceptor)
export class MailController {
  constructor(
    private readonly mailService: MailService,
    private readonly mailEventsService: MailEventsService,
    private readonly rateLimitService: RateLimitService,
  ) {}


  @Get()
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'mail:list:user', limit: 60, windowSeconds: 60, subject: 'user' })
  async listMyMails(
    @GetUserId() userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sort') sort?: string,   // 'newest', 'oldest', 'unread', 'read'
    @Query('folder') folder?: string, // 'inbox', 'archive', 'spam', 'all'
    @Query('search') search?: string
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
      folderMethod,
      search
    );
    
    return { message: 'Mails fetched successfully', result: data };
  }

  @Get('blocked-senders')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'mail:blocked-senders:list:user', limit: 60, windowSeconds: 60, subject: 'user' })
  async listBlockedSenders(@GetUserId() userId: string) {
    const result = await this.mailService.getBlockedSenders(userId);
    return { message: 'Blocked senders fetched successfully', result };
  }

  @Sse('events')
  @UseGuards(MailSseAuthGuard)
  streamMailEvents(@GetUserId() userId: string, @Req() request: Request): Observable<MessageEvent> {
    return this.rateLimitService.trackConcurrentSse(
      this.mailEventsService.streamForUser(userId),
      {
        scope: 'mail:events',
        userSubject: userId,
        userLimit: 3,
        ipSubject: this.rateLimitService.getClientIp(request),
        ipLimit: 5,
      },
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'mail:detail:user', limit: 60, windowSeconds: 60, subject: 'user' })
  async getSingleMail(
    @GetUserId() userId: string,
    @Param('id') mailId: string
  ) {
    const mail = await this.mailService.getSingleMail(userId, mailId);
    return { message: 'Mail fetched successfully', result: mail };
  }


  @Get(':mailId/attachment/:attachmentId')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit(
    { name: 'mail:attachment:user', limit: 60, windowSeconds: 60, subject: 'user' },
    { name: 'mail:attachment:attachment-user', limit: 120, windowSeconds: 60 * 60, subject: 'param-user', paramName: 'attachmentId' },
  )
  async downloadAttachment(
    @GetUserId() userId: string,
    @Param('mailId') mailId: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response
  ) {
    const file = await this.mailService.downloadAttachment(userId, mailId, attachmentId);

    // set header
    res.set({
      'Content-Type': file.mimetype,
      'Content-Length': file.buffer.length,
      'Content-Disposition': `attachment; filename="${file.filename}"`
    });
    
    res.send(file.buffer);
  }

  // --- SINGLE ACTIONS ---

  @Delete('block-sender')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'mail:block-sender:delete:user', limit: 30, windowSeconds: 60 * 60, subject: 'user' })
  async unblockSender(@GetUserId() userId: string, @Body() dto: BlockSenderDto) {
    const result = await this.mailService.unblockSender(userId, dto.email);
    return { message: 'Sender unblocked successfully', result };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'mail:actions:user', limit: 30, windowSeconds: 60, subject: 'user' })
  async deleteMail(@GetUserId() userId: string, @Param('id') mailId: string) {
    await this.mailService.deleteMail(userId, mailId);
    return { message: 'Mail deleted successfully' };
  }

  @Patch(':id/read-status')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'mail:actions:user', limit: 30, windowSeconds: 60, subject: 'user' })
  async updateReadStatus(@GetUserId() userId: string, @Param('id') mailId: string, @Body() dto: MarkReadDto) {
    await this.mailService.setReadStatus(userId, mailId, dto.isRead);
    return { message: `Mail marked as ${dto.isRead ? 'read' : 'unread'}` };
  }

  @Patch(':id/move')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'mail:actions:user', limit: 30, windowSeconds: 60, subject: 'user' })
  async moveMail(@GetUserId() userId: string, @Param('id') mailId: string, @Body() dto: MoveMailDto) {
    const result = await this.mailService.moveMail(userId, mailId, dto.folder);
    return { message: `Mail moved to ${dto.folder} successfully`, result };
  }

  // --- BULK ACTIONS ---

  @Post('bulk/delete')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'mail:actions:user', limit: 30, windowSeconds: 60, subject: 'user' })
  async bulkDelete(@GetUserId() userId: string, @Body() dto: BulkMailDto) {
    const result = await this.mailService.bulkDeleteMails(userId, dto.mailIds);
    return { message: 'Mails deleted successfully', result };
  }

  @Post('bulk/read-status')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'mail:actions:user', limit: 30, windowSeconds: 60, subject: 'user' })
  async bulkReadStatus(@GetUserId() userId: string, @Body() dto: BulkMarkReadDto) {
    const result = await this.mailService.bulkSetReadStatus(userId, dto.mailIds, dto.isRead);
    return { message: `Mails marked as ${dto.isRead ? 'read' : 'unread'}`, result };
  }

  @Post('bulk/move')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'mail:actions:user', limit: 30, windowSeconds: 60, subject: 'user' })
  async bulkMove(@GetUserId() userId: string, @Body() dto: BulkMoveMailDto) {
    const result = await this.mailService.bulkMoveMails(userId, dto.mailIds, dto.folder);
    return { message: `Mails moved to ${dto.folder} successfully`, result };
  }

  // --- SENDER BLOCKING ---

  @Post('block-sender')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'mail:block-sender:create:user', limit: 30, windowSeconds: 60 * 60, subject: 'user' })
  async blockSender(@GetUserId() userId: string, @Body() dto: BlockSenderDto) {
    const result = await this.mailService.blockSender(userId, dto.email);
    return { message: 'Sender blocked successfully', result };
  }

  @Post('bulk/unblock-sender')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'mail:block-sender:bulk-unblock:user', limit: 30, windowSeconds: 60 * 60, subject: 'user' })
  async bulkUnblockSenders(@GetUserId() userId: string, @Body() dto: BulkUnblockSenderDto) {
    const result = await this.mailService.bulkUnblockSenders(userId, dto.emails);
    return { message: 'Blocked senders unblocked successfully', result };
  }


  // --- INCOMING WEBHOOK ---
  // using timingSafeEqual to prevent attackers from guessing the passphrase with respondtime
  @Post('incoming')
  @UseGuards(RateLimitGuard)
  @RateLimit(
    { name: 'mail:incoming:ip', limit: 120, windowSeconds: 60 * 60, subject: 'ip' },
    { name: 'mail:incoming:recipient', limit: 30, windowSeconds: 60 * 60, subject: 'mail-recipient' },
  )
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
