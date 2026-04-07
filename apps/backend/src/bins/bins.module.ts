import { Module } from '@nestjs/common';
import { BinsController } from './bins.controller';
import { BinsService } from './bins.service';

@Module({
  controllers: [BinsController],
  providers: [BinsService],
})
export class BinsModule {}