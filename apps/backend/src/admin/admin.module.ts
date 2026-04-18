import { Module } from '@nestjs/common';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminJwtStrategy } from './strategy/admin-jwt.strategy';
import { AdminRtStrategy } from './strategy/admin-rt.strategy';
import { UsersService } from '../users/users.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule.forRoot({
      type: 'single',
      url: 'redis://localhost:6379',
    }),
    PrismaModule,
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AdminAuthController, AdminController],
  providers: [AdminService, AdminAuthService, AdminJwtStrategy, AdminRtStrategy, UsersService],
})
export class AdminModule {}
