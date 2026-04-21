import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
import { AdminDefaultRateLimit } from 'src/common/rate-limit/rate-limit.decorators';
import { RateLimitGuard } from 'src/common/rate-limit/rate-limit.guard';
import {
  AdminInviteCodesQueryDto,
  CreateAdminInviteCodeDto,
  CreateRandomAdminInviteCodeDto,
  UpdateAdminInviteCodeValidityDto,
} from '../dto/invites.dto';
import { AdminJwtAuthGuard } from '../guard/admin-auth.guard';
import { AdminInvitesService } from './admin-invites.service';

@Controller('admin')
@AdminDefaultRateLimit()
@UseGuards(AdminJwtAuthGuard, RateLimitGuard)
export class AdminInvitesController {
  constructor(private readonly adminInvitesService: AdminInvitesService) {}

  @Get('invite-codes')
  async getInviteCodes(@GetUserId() adminUserId: string, @Query() query: AdminInviteCodesQueryDto) {
    return {
      message: 'Invite codes fetched successfully',
      result: await this.adminInvitesService.getInviteCodes(adminUserId, query),
    };
  }

  @Post('invite-codes')
  async createInviteCode(
    @GetUserId() adminUserId: string,
    @Body() dto: CreateAdminInviteCodeDto,
  ) {
    const result = await this.adminInvitesService.createInviteCode(adminUserId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Post('invite-codes/random')
  async createRandomInviteCode(
    @GetUserId() adminUserId: string,
    @Body() dto: CreateRandomAdminInviteCodeDto,
  ) {
    const result = await this.adminInvitesService.createRandomInviteCode(adminUserId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Delete('invite-codes/:inviteCodeId')
  async deleteInviteCode(
    @GetUserId() adminUserId: string,
    @Param('inviteCodeId') inviteCodeId: string,
  ) {
    const result = await this.adminInvitesService.deleteInviteCode(adminUserId, inviteCodeId);
    return {
      message: result.message,
      result,
    };
  }

  @Patch('invite-codes/:inviteCodeId/validity')
  async updateInviteCodeValidity(
    @GetUserId() adminUserId: string,
    @Param('inviteCodeId') inviteCodeId: string,
    @Body() dto: UpdateAdminInviteCodeValidityDto,
  ) {
    const result = await this.adminInvitesService.updateInviteCodeValidity(
      adminUserId,
      inviteCodeId,
      dto,
    );
    return {
      message: result.message,
      result,
    };
  }
}
