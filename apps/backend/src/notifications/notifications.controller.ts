import { Controller, Get, Header, Req, Sse, UseGuards } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guard/auth.guard';
import { RateLimit } from 'src/common/rate-limit/rate-limit.decorators';
import { RateLimitGuard } from 'src/common/rate-limit/rate-limit.guard';
import { RateLimitService } from 'src/common/rate-limit/rate-limit.service';
import { NotificationsSseAuthGuard } from './guard/notifications-sse-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'notifications:list:user', limit: 60, windowSeconds: 60, subject: 'user' })
  async getActiveNotifications() {
    return {
      message: 'Notifications fetched successfully',
      result: await this.notificationsService.getActiveNotifications(),
    };
  }

  @Sse('events')
  @Header('Cache-Control', 'no-cache, no-transform')
  @Header('X-Accel-Buffering', 'no')
  @UseGuards(NotificationsSseAuthGuard)
  streamNotifications(
    @GetUserId() userId: string,
    @Req() request: Request,
  ): Observable<MessageEvent> {
    return this.rateLimitService.trackConcurrentSse(
      this.notificationsService.streamActiveNotifications(),
      {
        scope: 'notifications:events',
        userSubject: userId,
        userLimit: 3,
        ipSubject: this.rateLimitService.getClientIp(request),
        ipLimit: 5,
      },
    );
  }
}
