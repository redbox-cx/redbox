import { Module } from '@nestjs/common';
import { RedisModule } from '@nestjs-modules/ioredis';
import { MailEventsService } from 'src/mail/mail-events.service';
import { MailService } from 'src/mail/mail.service';
import { AdminMailsController } from './admin-mails.controller';
import { AdminMailsService } from './admin-mails.service';

@Module({
  imports: [
    RedisModule.forRoot({
      type: 'single',
      url: 'redis://localhost:6379',
    }),
  ],
  controllers: [AdminMailsController],
  providers: [AdminMailsService, MailService, MailEventsService],
})
export class AdminMailsModule {}
