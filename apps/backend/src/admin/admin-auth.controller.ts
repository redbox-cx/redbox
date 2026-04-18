import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GetUser, GetUserId } from 'src/auth/decorator/get-user.decorator';
import { AdminJwtAuthGuard } from './guard/admin-auth.guard';
import { AdminAuthService } from './admin-auth.service';
import { AdminChangePasswordDto, AdminLoginDto } from './dto/auth.dto';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  async login(@Body() dto: AdminLoginDto) {
    const result = await this.adminAuthService.login(dto);
    return {
      message: 'Successfully logged in',
      result,
    };
  }

  @Post('refresh')
  @UseGuards(AuthGuard('admin-jwt-refresh'))
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
  @UseGuards(AdminJwtAuthGuard)
  async logout(@GetUserId() adminId: string) {
    const result = await this.adminAuthService.logout(adminId);
    return {
      message: 'Logged out successfully',
      result,
    };
  }

  @Post('change-password')
  @UseGuards(AdminJwtAuthGuard)
  async changePassword(@GetUserId() adminId: string, @Body() dto: AdminChangePasswordDto) {
    const result = await this.adminAuthService.changePassword(adminId, dto);
    return {
      message: result.message,
      result,
    };
  }
}
