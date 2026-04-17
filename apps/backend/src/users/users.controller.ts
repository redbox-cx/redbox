import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guard/auth.guard';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { GetUserId } from '../auth/decorator/get-user.decorator';
import { AccountDeletionPasswordDto } from './dto/account-deletion.dto';



@Controller('/user')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
    ){}

    @Get('/profile')
    async getProfile(@GetUserId() userId: string) {
        const profile = await this.usersService.getProfile(userId);
        return {
            message: 'Profile fetched successfully',
            result: profile
        };
    }

    @Post('/avatar')
    async updateAvatar(@GetUserId() userId: string, @Body() dto: UpdateAvatarDto) {
        const updatedUser = await this.usersService.updateAvatar(userId, dto.avatar);
        return {
            message: 'Avatar updated successfully',
            result: updatedUser
        };
    }

    @Post('/invites')
    async generate(@GetUserId() userId: string) {
        const newInvite = await this.usersService.generateInviteCode(userId);
        return {
            message: 'Invite code generated',
            result: newInvite
        };
    }

    @Get('/invites')
    async getMyInvites(@GetUserId() userId: string) {
        const invites = await this.usersService.getMyInvites(userId);
        return {
            message: 'Your invite codes',
            result: invites
        };
    }

    @Post('/account/delete-request')
    async requestAccountDeletion(@GetUserId() userId: string, @Body() dto: AccountDeletionPasswordDto) {
        const result = await this.usersService.requestAccountDeletion(userId, dto.password);
        return {
            message: 'Account deletion requested successfully',
            result,
        };
    }

    @Post('/account/cancel-delete-request')
    async cancelAccountDeletion(@GetUserId() userId: string, @Body() dto: AccountDeletionPasswordDto) {
        const result = await this.usersService.cancelAccountDeletion(userId, dto.password);
        return {
            message: 'Account deletion request cancelled successfully',
            result,
        };
    }
}
