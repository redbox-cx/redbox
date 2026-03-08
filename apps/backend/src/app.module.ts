import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma.module';
import { FilesModule } from './files/files.module';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from '@nestjs-modules/ioredis';
import { LinksModule } from './links/links.module';

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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
