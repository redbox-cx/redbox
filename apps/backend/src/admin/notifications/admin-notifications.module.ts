import { Module } from '@nestjs/common';
import { NotificationEventsService } from 'src/notifications/notification-events.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { AdminNotificationsController } from './admin-notifications.controller';

@Module({
  controllers: [AdminNotificationsController],
  providers: [NotificationsService, NotificationEventsService],
})
export class AdminNotificationsModule {}
