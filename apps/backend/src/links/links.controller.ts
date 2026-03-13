import { Controller, Get, Post, Body, UseGuards, Req, Param, Res, Delete } from '@nestjs/common';
import { LinksService } from './links.service';
import { JwtAuthGuard } from 'src/auth/guard/auth.guard';
import { CreateLinkDto } from './dto/create-link.dto';
import express from 'express';

@Controller('/links')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateLinkDto, @Req() req) {
    return this.linksService.create(req.user.id, dto.url);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getAll(@Req() req) {
    return this.linksService.findAllByUser(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id') linkId: string, @Req() req) {
    return this.linksService.delete(req.user.id, linkId);
  }

  // forwarding (public)
  // this route must be at the bottom
  @Get('redirect/:code')
  async redirect(@Param('code') code: string, @Res() res: express.Response) {
    const url = await this.linksService.getOriginalUrl(code);
    return res.redirect(url);
  }
}