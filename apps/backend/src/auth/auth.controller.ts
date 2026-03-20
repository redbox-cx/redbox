import { Controller,Post,Get,Req,Res,Body, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login-user.dto";
import { RegisterUsersDto } from "./dto/register-user.dto";
import { AuthGuard } from "@nestjs/passport";
import { JwtAuthGuard } from "./guard/auth.guard";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { GetUserId, GetUser } from "./decorator/get-user.decorator";



@Controller('/auth')
export class AuthController{

    constructor(private readonly authService:AuthService){}


    @Post('/login')
    async login(@Body() loginDto: LoginDto) {
        const result = await this.authService.login(loginDto);
        return {
            message: 'Successfully logged in',
            result
        };
    }

    @Post('/register')
    async register(@Body() registerDto: RegisterUsersDto) {
        const result = await this.authService.register(registerDto);
        return {
            message: 'Successfully registered',
            result
        };
    }


    @Post('/refresh')
    @UseGuards(AuthGuard('jwt-refresh'))
    async refresh(
        @GetUserId() userId: string,
        @GetUser('sessionKey') sessionKey: string
    ) {
        const result = await this.authService.refreshToken(userId, sessionKey);
        return {
            message: 'Token refreshed',
            result
        };
    }

    @Post('/logout')
    @UseGuards(JwtAuthGuard)
    async logout(@GetUserId() userId: string) {
        const result = await this.authService.logout(userId);
        return {
            message: 'Logged out successfully',
            result
        };
    }


    @Post('/password')
    @UseGuards(JwtAuthGuard)
    async changePassword(
        @GetUserId() userId: string, 
        @Body() dto: ChangePasswordDto
    ) {
        return this.authService.changePassword(userId, dto);
    }
}