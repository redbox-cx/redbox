import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma.module';
import { AdminAuthModule } from './auth/admin-auth.module';
import { AdminAuditModule } from './audit/admin-audit.module';
import { AdminBlogModule } from './blog/admin-blog.module';
import { AdminDashboardModule } from './dashboard/admin-dashboard.module';
import { AdminLogsModule } from './logs/admin-logs.module';
import { AdminMailsModule } from './mails/admin-mails.module';
import { AdminReportsModule } from './reports/admin-reports.module';
import { AdminRoutesModule } from './routes/admin-routes.module';
import { AdminUsersModule } from './users/admin-users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AdminAuthModule,
    AdminUsersModule,
    AdminAuditModule,
    AdminReportsModule,
    AdminDashboardModule,
    AdminRoutesModule,
    AdminMailsModule,
    AdminBlogModule,
    AdminLogsModule,
  ],
  controllers: [],
  providers: [],
})
export class AdminModule {}
