import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma.module';
import { FilesModule } from './files/files.module';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from '@nestjs-modules/ioredis';
import { LinksModule } from './links/links.module';
import { BinsModule } from './bins/bins.module';
import { MailModule } from './mail/mail.module';
import { ReportsModule } from './reports/reports.module';
import { BlogModule } from './blog/blog.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    RedisModule.forRoot({
      type: 'single',
      url: `redis://localhost:6379`, 
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    FilesModule,
    LinksModule,
    BinsModule,
    MailModule,
    ReportsModule,
    BlogModule,
    NotificationsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
