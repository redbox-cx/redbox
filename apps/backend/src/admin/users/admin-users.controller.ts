import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
import { AdminJwtAuthGuard } from '../guard/admin-auth.guard';
import { AdminUsersService } from './admin-users.service';
import {
  AdminUsersQueryDto,
  ChangeAdminUsernameDto,
  ClearAdminUserDataDto,
  DeleteAdminUserFilesDto,
  ForceLogoutAdminUserDto,
  UpdateAdminUserStatusDto,
} from '../dto/users.dto';

@Controller('admin')
@UseGuards(AdminJwtAuthGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get('usercount')
  async getUserCountLegacy() {
    return {
      message: 'User count fetched successfully',
      result: await this.adminUsersService.getUserCountSummary(),
    };
  }

  @Get('users/count-summary')
  async getUserCountSummary() {
    return {
      message: 'User count fetched successfully',
      result: await this.adminUsersService.getUserCountSummary(),
    };
  }

  @Get('users/stats')
  async getUsersStats() {
    return {
      message: 'User stats fetched successfully',
      result: await this.adminUsersService.getUsersStats(),
    };
  }

  @Get('users/overview-stats')
  async getUsersOverviewStats() {
    return {
      message: 'User overview stats fetched successfully',
      result: await this.adminUsersService.getUsersOverviewStats(),
    };
  }

  @Get('users')
  async getUsers(@Query() query: AdminUsersQueryDto) {
    return {
      message: 'Users fetched successfully',
      result: await this.adminUsersService.getUsers(query),
    };
  }

  @Get('users/:userId')
  async getUserById(@Param('userId') userId: string) {
    return {
      message: 'User fetched successfully',
      result: await this.adminUsersService.getUserById(userId),
    };
  }

  @Patch('users/:userId/status')
  async updateUserStatus(
    @GetUserId() adminUserId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateAdminUserStatusDto,
  ) {
    const result = await this.adminUsersService.updateUserStatus(adminUserId, userId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Post('users/:userId/force-logout')
  async forceLogoutUser(
    @GetUserId() adminUserId: string,
    @Param('userId') userId: string,
    @Body() dto: ForceLogoutAdminUserDto,
  ) {
    const result = await this.adminUsersService.forceLogoutUser(adminUserId, userId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Patch('users/:userId/username')
  async changeUsername(
    @GetUserId() adminUserId: string,
    @Param('userId') userId: string,
    @Body() dto: ChangeAdminUsernameDto,
  ) {
    const result = await this.adminUsersService.changeUsername(adminUserId, userId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Delete('users/:userId/files')
  async deleteUserFiles(
    @GetUserId() adminUserId: string,
    @Param('userId') userId: string,
    @Body() dto: DeleteAdminUserFilesDto,
  ) {
    return {
      message: 'User files deleted successfully',
      result: await this.adminUsersService.deleteUserFiles(adminUserId, userId, dto),
    };
  }

  @Delete('users/:userId/data')
  async clearUserData(
    @GetUserId() adminUserId: string,
    @Param('userId') userId: string,
    @Body() dto: ClearAdminUserDataDto,
  ) {
    return {
      message: 'User data cleared successfully',
      result: await this.adminUsersService.clearUserData(adminUserId, userId, dto),
    };
  }
}
