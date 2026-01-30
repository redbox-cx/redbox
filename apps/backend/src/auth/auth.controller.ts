import { Controller,Post,Get,Req,Res,Body, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login-user.dto";
import express from 'express';
import { RegisterUsersDto } from "./dto/register-user.dto";
import { AuthGuard } from "@nestjs/passport";
import { JwtAuthGuard } from "./guard/auth.guard";
import { UsersService } from "src/users/users.service";
import { ChangePasswordDto } from "./dto/change-password.dto";



@Controller('/auth')
export class AuthController{

    constructor(private readonly authService:AuthService, private readonly usersService:UsersService){}


    @Post('/login')
    async login(@Req() request:express.Request, @Res() response :express.Response, @Body() loginDto: LoginDto):Promise<any>{
        try{
            const result= await this.authService.login(loginDto);
            return response.status(200).json({
                status: 'Ok',
                message: 'Successfully logged in',
                result: result
            })

        }catch(err){
            if (err.status && err.response) {
                return response.status(err.status).json(err.response);
            }
            console.error(err);
                return response.status(500).json({
                status: 'Error',
                message: 'Internal Server Error',
            })
        }
    }

    @Post('/register')
    async register(@Req() request:express.Request, @Res() response :express.Response, @Body() registerDto: RegisterUsersDto):Promise<any>{
        try{
            const result= await this.authService.register(registerDto);
            return response.status(200).json({
                status: 'Ok',
                message: 'Successfully registered',
                result: result
            })

        }catch(err){
            if (err.status && err.response) {
                return response.status(err.status).json(err.response);
            }
            console.error(err);
                return response.status(500).json({
                status: 'Error',
                message: 'Internal Server Error',
            })
        }
    }


    @Post('/refresh')
    @UseGuards(AuthGuard('jwt-refresh'))
    async refresh(@Req() req: any, @Res() response: express.Response) {
        try {
            const userId = req.user.sub;
            const sessionKey = req.user.sessionKey; 

            const result = await this.authService.refreshToken(userId, sessionKey);
            
            return response.status(200).json({
                status: 'Ok',
                message: 'Token refreshed',
                result: result
            });
        } catch (err) {
            if (err.status && err.response) {
                return response.status(err.status).json(err.response);
            }
            console.error("Refresh Error:", err);
            return response.status(500).json({
                status: 'Error',
                message: 'Internal Server Error',
            });
        }
    }



    @Post('/logout')
    @UseGuards(JwtAuthGuard)
    async logout(@Req() req: any, @Res() response: express.Response) {
        try {
            const userId = req.user.id;
            const result = await this.authService.logout(userId);
            
            return response.status(200).json({
                status: 'Ok',
                message: 'Logged out successfully',
                result: result
            });
        } catch (err) {
            console.error("Logout Error:", err);
            return response.status(500).json({
                status: 'Error',
                message: 'Internal Server Error',
            });
        }
    }


    @Post('/change-password')
    @UseGuards(JwtAuthGuard)
    async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
        return this.authService.changePassword(req.user.id, dto);
    }
}