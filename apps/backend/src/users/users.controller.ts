import { Controller, Get, Post, Body, UseGuards, Req, Res } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guard/auth.guard';
import { UpdateAvatarDto } from './dto/update-avatar.dto';



@Controller('/user')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
    ){}

    @Get('/profile')
    async getProfile(@Req() req: any) {
        return this.usersService.getProfile(req.user.id);
    }

    @Post('/avatar')
    async updateAvatar(@Req() req: any, @Body() dto: UpdateAvatarDto) {
        return this.usersService.updateAvatar(req.user.id, dto.avatar);
    }

    @Post('/invites')
    async generate(@Req() req: any) {
        return this.usersService.generateInviteCode(req.user.id);
    }

    @Get('/invites')
    async getMyInvites(@Req() req: any) {
        return this.usersService.getMyInvites(req.user.id);
    }
}