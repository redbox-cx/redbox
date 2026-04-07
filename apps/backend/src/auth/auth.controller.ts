import { Controller,Post,Get,Req,Res,Body, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login-user.dto";
import { RegisterUsersDto } from "./dto/register-user.dto";
import { PreValidateDto } from "./dto/pre-validate.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { RecoverPasswordDto } from "./dto/recover-password.dto";
import { AuthGuard } from "@nestjs/passport";
import { JwtAuthGuard } from "./guard/auth.guard";
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

    @Post('/pre-validate')
    async preValidate(@Body() dto: PreValidateDto) {
        await this.authService.preValidate(dto.username, dto.inviteCode);
        return { message: 'Credentials valid' };
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

    @Get('/recovery-phrase/generate')
    generatePhrase() {
        const data = this.authService.generateRecoveryPhrase();
        return {
            message: 'Recovery phrase successfully generated',
            result: data 
        };
    }

    @Post('/recover-password')
    async recoverPassword(@Body() dto: RecoverPasswordDto) {
        const result = await this.authService.recoverPassword(dto);
        return {
            message: result.message,
            result
        };
    }
}