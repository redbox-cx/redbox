import { Controller,Post,Get,Req,Res,Body, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login-user.dto";
import { RegisterUsersDto } from "./dto/register-user.dto";
import { PreValidateDto } from "./dto/pre-validate.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { RecoverPasswordDto } from "./dto/recover-password.dto";
import { ReactivateAccountDto } from "./dto/reactivate-account.dto";
import { AuthGuard } from "@nestjs/passport";
import { JwtAuthGuard } from "./guard/auth.guard";
import { GetUserId, GetUser } from "./decorator/get-user.decorator";
import { RateLimit } from "src/common/rate-limit/rate-limit.decorators";
import { RateLimitGuard } from "src/common/rate-limit/rate-limit.guard";



@Controller('/auth')
export class AuthController{

    constructor(private readonly authService:AuthService){}


    @Post('/login')
    @UseGuards(RateLimitGuard)
    @RateLimit(
        { name: 'auth:login:username-ip', limit: 5, windowSeconds: 60, subject: 'username-ip' },
        { name: 'auth:login:ip', limit: 20, windowSeconds: 15 * 60, subject: 'ip' },
    )
    async login(@Body() loginDto: LoginDto) {
        const result = await this.authService.login(loginDto);
        return {
            message: result?.loginState === 'pending_deletion'
                ? 'Account is pending deletion'
                : 'Successfully logged in',
            result
        };
    }

    @Post('/pre-validate')
    @UseGuards(RateLimitGuard)
    @RateLimit(
        { name: 'auth:pre-validate:ip', limit: 10, windowSeconds: 10 * 60, subject: 'ip' },
        { name: 'auth:pre-validate:username-ip', limit: 5, windowSeconds: 10 * 60, subject: 'username-ip' },
    )
    async preValidate(@Body() dto: PreValidateDto) {
        await this.authService.preValidate(dto.username, dto.inviteCode);
        return { message: 'Credentials valid' };
    }

    @Post('/register')
    @UseGuards(RateLimitGuard)
    @RateLimit(
        { name: 'auth:register:ip-hour', limit: 3, windowSeconds: 60 * 60, subject: 'ip' },
        { name: 'auth:register:ip-day', limit: 10, windowSeconds: 24 * 60 * 60, subject: 'ip' },
    )
    async register(@Body() registerDto: RegisterUsersDto) {
        const result = await this.authService.register(registerDto);
        return {
            message: 'Successfully registered',
            result
        };
    }


    @Post('/refresh')
    @UseGuards(AuthGuard('jwt-refresh'), RateLimitGuard)
    @RateLimit({ name: 'auth:refresh:user', limit: 30, windowSeconds: 60, subject: 'user' })
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
    @UseGuards(JwtAuthGuard, RateLimitGuard)
    @RateLimit({ name: 'auth:password:user', limit: 5, windowSeconds: 15 * 60, subject: 'user' })
    async changePassword(
        @GetUserId() userId: string, 
        @Body() dto: ChangePasswordDto
    ) {
        return this.authService.changePassword(userId, dto);
    }

    @Get('/recovery-phrase/generate')
    @UseGuards(RateLimitGuard)
    @RateLimit({ name: 'auth:recovery-phrase:ip', limit: 30, windowSeconds: 60, subject: 'ip' })
    generatePhrase() {
        const data = this.authService.generateRecoveryPhrase();
        return {
            message: 'Recovery phrase successfully generated',
            result: data 
        };
    }

    @Post('/recover-password')
    @UseGuards(RateLimitGuard)
    @RateLimit(
        { name: 'auth:recover-password:username-ip', limit: 3, windowSeconds: 15 * 60, subject: 'username-ip' },
        { name: 'auth:recover-password:ip', limit: 10, windowSeconds: 60 * 60, subject: 'ip' },
    )
    async recoverPassword(@Body() dto: RecoverPasswordDto) {
        const result = await this.authService.recoverPassword(dto);
        return {
            message: result.message,
            result
        };
    }

    @Post('/account/reactivate')
    @UseGuards(RateLimitGuard)
    @RateLimit({ name: 'auth:account-reactivate:ip', limit: 5, windowSeconds: 15 * 60, subject: 'ip' })
    async reactivateAccount(@Body() dto: ReactivateAccountDto) {
        const result = await this.authService.reactivateAccount(dto.reactivationToken);
        return {
            message: 'Account reactivated successfully',
            result,
        };
    }
}
