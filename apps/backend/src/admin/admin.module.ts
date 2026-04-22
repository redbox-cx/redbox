import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { PrismaModule } from '../prisma.module';
import { RateLimitModule } from '../common/rate-limit/rate-limit.module';
import { AdminAuthModule } from './auth/admin-auth.module';
import { AdminAuditModule } from './audit/admin-audit.module';
import { AdminBlogModule } from './blog/admin-blog.module';
import { AdminDashboardModule } from './dashboard/admin-dashboard.module';
import { AdminInvitesModule } from './invites/admin-invites.module';
import { AdminLogsModule } from './logs/admin-logs.module';
import { AdminMailsModule } from './mails/admin-mails.module';
import { AdminNotificationsModule } from './notifications/admin-notifications.module';
import { AdminReportsModule } from './reports/admin-reports.module';
import { AdminRoutesModule } from './routes/admin-routes.module';
import { AdminUsersModule } from './users/admin-users.module';
import { requireEnv } from '../common/config/env';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule.forRoot({
      type: 'single',
      url: requireEnv('REDIS_URL'),
    }),
    PrismaModule,
    RateLimitModule,
    AdminAuthModule,
    AdminUsersModule,
    AdminAuditModule,
    AdminReportsModule,
    AdminDashboardModule,
    AdminInvitesModule,
    AdminRoutesModule,
    AdminMailsModule,
    AdminBlogModule,
    AdminNotificationsModule,
    AdminLogsModule,
  ],
  controllers: [],
  providers: [],
})
export class AdminModule {}
