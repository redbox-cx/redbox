import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationEventsService } from './notification-events.service';
import { NotificationsSseAuthGuard } from './guard/notifications-sse-auth.guard';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationEventsService, NotificationsSseAuthGuard],
  exports: [NotificationsService, NotificationEventsService],
})
export class NotificationsModule {}
