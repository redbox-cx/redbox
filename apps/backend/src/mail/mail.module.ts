import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MailController } from './mail.controller';
import { MailEventsService } from './mail-events.service';
import { MailSseAuthGuard } from './guard/mail-sse-auth.guard';
import { MailService } from './mail.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [MailController],
  providers: [MailService, MailEventsService, MailSseAuthGuard],
  exports: [MailService, MailEventsService],
})
export class MailModule {}
