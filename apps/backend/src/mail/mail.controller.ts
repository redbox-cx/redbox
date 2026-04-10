import { Controller, Post, Get, Body, Req, UnauthorizedException, UseGuards, UseInterceptors } from '@nestjs/common';
import { MailService } from './mail.service';
import { IncomingMailDto } from './dto/incoming-mail.dto';
import type { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guard/auth.guard';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';

@Controller('mail')
@UseInterceptors(TransformInterceptor)
export class MailController {
  constructor(private readonly mailService: MailService) {}


  @Get()
  @UseGuards(JwtAuthGuard)
  async listMyMails(@GetUserId() userId: string) {
    const mails = await this.mailService.getUserMails(userId);
    
    return { 
        message: 'Mails fetched successfully', 
        result: mails 
    };
  }


  @Post('incoming')
  async receiveMail(@Req() req: Request, @Body() dto: IncomingMailDto) {
    
    const webhookSecret = req.headers['x-redbox-webhook-secret'];
    
    if (!webhookSecret || webhookSecret !== process.env.MAIL_WEBHOOK_SECRET) {
      throw new UnauthorizedException('Invalid Webhook Secret');
    }

    const result = await this.mailService.processIncomingMail(dto);
    
    return {
      message: 'Webhook received successfully',
      result
    };
  }
}