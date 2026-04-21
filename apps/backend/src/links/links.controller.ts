import { Controller, Get, Post, Body, UseGuards, Req, Param, Res, Delete } from '@nestjs/common';
import { LinksService } from './links.service';
import { JwtAuthGuard } from 'src/auth/guard/auth.guard';
import { CreateLinkDto } from './dto/create-link.dto';
import type { Response } from 'express';
import { RateLimit } from 'src/common/rate-limit/rate-limit.decorators';
import { RateLimitGuard } from 'src/common/rate-limit/rate-limit.guard';

@Controller('/links')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'links:create:user', limit: 40, windowSeconds: 60 * 60, subject: 'user' })
  @Post()
  async create(@Body() dto: CreateLinkDto, @Req() req) {
    return this.linksService.create(req.user.id, dto.url);
  }

  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'links:list:user', limit: 60, windowSeconds: 60, subject: 'user' })
  @Get()
  async getAll(@Req() req) {
    const links = await this.linksService.findAllByUser(req.user.id);
    return { message: 'Links fetched successfully', result: links };
  }

  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ name: 'links:delete:user', limit: 30, windowSeconds: 60, subject: 'user' })
  @Delete(':id')
  async delete(@Param('id') linkId: string, @Req() req) {
    return this.linksService.delete(req.user.id, linkId);
  }

  // forwarding (public)
  // this route must be at the bottom
  @Get('redirect/:code')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'links:redirect:ip', limit: 300, windowSeconds: 60, subject: 'ip' })
  async redirect(@Param('code') code: string, @Res() res: Response) {
    const url = await this.linksService.getOriginalUrl(code);
    return res.redirect(url);
  }
}
