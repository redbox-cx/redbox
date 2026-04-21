import { Controller, Get, Sse, UseGuards } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from 'src/auth/guard/auth.guard';
import { NotificationsSseAuthGuard } from './guard/notifications-sse-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getActiveNotifications() {
    return {
      message: 'Notifications fetched successfully',
      result: await this.notificationsService.getActiveNotifications(),
    };
  }

  @Sse('events')
  @UseGuards(NotificationsSseAuthGuard)
  streamNotifications(): Observable<MessageEvent> {
    return this.notificationsService.streamActiveNotifications();
  }
}
