import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guard/auth.guard';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { GetUserId } from '../auth/decorator/get-user.decorator';



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
}