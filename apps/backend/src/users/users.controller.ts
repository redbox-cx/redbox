import { Controller, Get, Req, Res } from "@nestjs/common";
import { UsersService } from "./users.service";
import express from "express";



@Controller('users')
export class UsersController {
    constructor(private readonly userService : UsersService){}

    @Get()
    async getAllUsers(@Req() request: express.Request, @Res() response: express.Response):Promise<any>{
        try{
            const result = await this.userService.getAllUser();
            return response.status(200).json({
                status: 'Ok!',
                message: 'Successfully fetch data!',
                result: result
            })
        }catch(err){
            return response.status(500).json({
                status: 'Ok!',
                message: 'Internal Server Error!'
            })
        }

    }
}