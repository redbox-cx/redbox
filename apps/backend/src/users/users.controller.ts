import { Controller, Get, Req, Res } from "@nestjs/common";
import { UsersService } from "./users.service";
import express from "express";



@Controller('users')
export class UsersController {
    constructor(private readonly userService : UsersService){}
}