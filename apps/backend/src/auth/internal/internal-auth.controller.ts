import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { InternalAuthService } from './internal-auth.service';
import {
  InternalLoginDto,
  InternalProfileDto,
  InternalValidateDto,
} from './internal-auth.dto';
import { InternalServiceGuard } from './internal-service.guard';

@Controller('/internal/auth')
@UseGuards(InternalServiceGuard)
export class InternalAuthController {
  constructor(private readonly internalAuthService: InternalAuthService) {}

  @Post('/login')
  async login(
    @Body() dto: InternalLoginDto,
    @Res() res: Response,
  ): Promise<void> {
    res.json(await this.internalAuthService.login(dto));
  }

  @Post('/validate')
  async validate(
    @Body() dto: InternalValidateDto,
    @Res() res: Response,
  ): Promise<void> {
    res.json(await this.internalAuthService.validate(dto));
  }

  @Post('/profile')
  async profile(
    @Body() dto: InternalProfileDto,
    @Res() res: Response,
  ): Promise<void> {
    res.json(await this.internalAuthService.profile(dto));
  }
}
