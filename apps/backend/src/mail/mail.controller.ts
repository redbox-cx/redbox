import { Controller, Post, Get, Body, Req, UnauthorizedException, UseGuards, UseInterceptors, Query, Param } from '@nestjs/common';
import { MailService } from './mail.service';
import { IncomingMailDto } from './dto/incoming-mail.dto';
import type { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guard/auth.guard';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';
import { timingSafeEqual } from 'crypto';

@Controller('mail')
@UseInterceptors(TransformInterceptor)
export class MailController {
  constructor(private readonly mailService: MailService) {}


  @Get()
  @UseGuards(JwtAuthGuard)
  async listMyMails(
    @GetUserId() userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    const safeLimit = parsedLimit > 100 ? 100 : parsedLimit;

    const data = await this.mailService.getUserMails(userId, safeLimit, parsedOffset);
    
    return { 
        message: 'Mails fetched successfully', 
        result: data
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getSingleMail(
    @GetUserId() userId: string,
    @Param('id') mailId: string
  ) {
    const mail = await this.mailService.getSingleMail(userId, mailId);
    
    return {
        message: 'Mail fetched successfully',
        result: mail
    };
  }



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