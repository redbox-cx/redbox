import { Controller,Post,Req,Res,Body, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login-user.dto";
import express from 'express';
import { RegisterUsersDto } from "./dto/register-user.dto";
import { AuthGuard } from "@nestjs/passport";
import { JwtAuthGuard } from "./auth.guard";



@Controller('/auth')
export class AuthController{



    constructor(private readonly authService:AuthService){}


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
    async refresh(@Req() req: any) {
        const user = req.user;
        return this.authService.refreshToken(user.sub, user.refreshToken);
    }


    @Post('/logout')
    @UseGuards(JwtAuthGuard)
    async logout(@Req() req: any) {
        return this.authService.logout(req.user.id);
    }

}