import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { GetUser, GetUserId } from 'src/auth/decorator/get-user.decorator';
import { RateLimit } from 'src/common/rate-limit/rate-limit.decorators';
import { RateLimitGuard } from 'src/common/rate-limit/rate-limit.guard';
import { AdminJwtAuthGuard } from '../guard/admin-auth.guard';
import { AdminAuthService } from './admin-auth.service';
import { AdminChangePasswordDto, AdminLoginDto } from '../dto/auth.dto';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @UseGuards(RateLimitGuard)
  @RateLimit(
    { name: 'admin:auth:login:username-ip', limit: 3, windowSeconds: 60, subject: 'username-ip' },
    { name: 'admin:auth:login:ip', limit: 10, windowSeconds: 15 * 60, subject: 'ip' },
  )
  async login(@Body() dto: AdminLoginDto, @Req() request: Request) {
    const result = await this.adminAuthService.login(dto, this.getLoginAuditContext(request));
    return {
      message: 'Successfully logged in',
      result,
    };
  }

  @Post('refresh')
  @UseGuards(AuthGuard('admin-jwt-refresh'), RateLimitGuard)
  @RateLimit({ name: 'admin:auth:refresh:admin', limit: 20, windowSeconds: 60, subject: 'admin' })
  async refresh(
    @GetUserId() adminId: string,
    @GetUser('sessionKey') sessionKey: string,
  ) {
    const result = await this.adminAuthService.refreshToken(adminId, sessionKey);
    return {
      message: 'Token refreshed',
      result,
    };
  }

  @Post('logout')
  @UseGuards(AdminJwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'admin:auth:logout:admin', limit: 20, windowSeconds: 60, subject: 'admin' })
  async logout(@GetUserId() adminId: string) {
    const result = await this.adminAuthService.logout(adminId);
    return {
      message: 'Logged out successfully',
      result,
    };
  }

  @Post('change-password')
  @UseGuards(AdminJwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'admin:auth:change-password:admin', limit: 5, windowSeconds: 15 * 60, subject: 'admin' })
  async changePassword(@GetUserId() adminId: string, @Body() dto: AdminChangePasswordDto) {
    const result = await this.adminAuthService.changePassword(adminId, dto);
    return {
      message: result.message,
      result,
    };
  }

  private getLoginAuditContext(request: Request) {
    const cfConnectingIp = this.normalizeHeader(request.get('cf-connecting-ip'));
    const trueClientIp = this.normalizeHeader(request.get('true-client-ip'));
    const forwardedFor = this.normalizeHeader(request.get('x-forwarded-for'));
    const forwardedClientIp = forwardedFor?.split(',')[0]?.trim() || null;
    const requestIp = this.normalizeHeader(request.ip);
    const remoteAddress = this.normalizeHeader(request.socket.remoteAddress);
    const ipAddress =
      cfConnectingIp ?? trueClientIp ?? forwardedClientIp ?? requestIp ?? remoteAddress;

    return {
      ipAddress,
      ipSource: cfConnectingIp
        ? 'cf-connecting-ip'
        : trueClientIp
          ? 'true-client-ip'
          : forwardedClientIp
            ? 'x-forwarded-for'
            : requestIp
              ? 'request-ip'
              : remoteAddress
                ? 'remote-address'
                : null,
      userAgent: this.truncateHeader(this.normalizeHeader(request.get('user-agent'))),
      forwardedFor: this.truncateHeader(forwardedFor),
      cfRay: this.truncateHeader(this.normalizeHeader(request.get('cf-ray'))),
    };
  }

  private normalizeHeader(value: string | undefined) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private truncateHeader(value: string | null) {
    return value && value.length > 500 ? value.slice(0, 500) : value;
  }
}
