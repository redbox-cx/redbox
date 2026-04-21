import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
import {
  CreateSystemNotificationDto,
  SystemNotificationsQueryDto,
} from 'src/notifications/dto/notifications.dto';
import { NotificationsService } from 'src/notifications/notifications.service';
import { AdminJwtAuthGuard } from '../guard/admin-auth.guard';

@Controller('admin')
@UseGuards(AdminJwtAuthGuard)
export class AdminNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('notifications')
  async getNotifications(@Query() query: SystemNotificationsQueryDto) {
    return {
      message: 'Notifications fetched successfully',
      result: await this.notificationsService.getAdminNotifications(query),
    };
  }

  @Post('notifications')
  async createNotification(
    @GetUserId() adminUserId: string,
    @Body() dto: CreateSystemNotificationDto,
  ) {
    const result = await this.notificationsService.createNotification(adminUserId, dto);
    return {
      message: result.message,
      result,
    };
  }
}
