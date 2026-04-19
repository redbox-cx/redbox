import { Module } from '@nestjs/common';
import { AdminMailsController } from './admin-mails.controller';
import { AdminMailsService } from './admin-mails.service';

@Module({
  controllers: [AdminMailsController],
  providers: [AdminMailsService],
})
export class AdminMailsModule {}
