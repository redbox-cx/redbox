import { Module } from '@nestjs/common';
import { AdminInvitesController } from './admin-invites.controller';
import { AdminInvitesService } from './admin-invites.service';

@Module({
  controllers: [AdminInvitesController],
  providers: [AdminInvitesService],
})
export class AdminInvitesModule {}
