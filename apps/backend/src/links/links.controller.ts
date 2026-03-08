import { Controller, Get, Post, Body, UseGuards, Req, Param, Res, Redirect, Version, VERSION_NEUTRAL } from '@nestjs/common';
import { LinksService } from './links.service';
import { JwtAuthGuard } from 'src/auth/guard/auth.guard';
import { CreateLinkDto } from './dto/create-link.dto';
import express from 'express';

@Controller()
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @UseGuards(JwtAuthGuard)
  @Post('/links')
  async create(@Body() dto: CreateLinkDto, @Req() req) {
    return this.linksService.create(req.user.id, dto.url);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/links')
  async getAll(@Req() req) {
    return this.linksService.findAllByUser(req.user.id);
  }

  // forwarding (public)
  // this route must be at the bottom
  @Version(VERSION_NEUTRAL)
  @Get(':code')
  async redirect(@Param('code') code: string, @Res() res: express.Response) {
    const url = await this.linksService.getOriginalUrl(code);
    return res.redirect(url);
  }
}