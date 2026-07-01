import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategy/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { RtStrategy } from './strategy/rt.strategy';
import { InternalAuthController } from './internal/internal-auth.controller';
import { InternalAuthService } from './internal/internal-auth.service';
import { InternalServiceGuard } from './internal/internal-service.guard';

@Module({
  imports: [UsersModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController, InternalAuthController],
  providers: [
    AuthService,
    JwtStrategy,
    RtStrategy,
    InternalAuthService,
    InternalServiceGuard,
  ],
})
export class AuthModule {}
