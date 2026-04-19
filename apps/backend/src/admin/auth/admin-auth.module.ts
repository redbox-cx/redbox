import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtStrategy } from '../strategy/admin-jwt.strategy';
import { AdminRtStrategy } from '../strategy/admin-rt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminJwtStrategy, AdminRtStrategy],
})
export class AdminAuthModule {}
