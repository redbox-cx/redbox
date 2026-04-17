import { ForbiddenException, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

@Injectable()
export class AdminRtStrategy extends PassportStrategy(Strategy, 'admin-jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.ADMIN_JWT_REFRESH_SECRET ?? process.env.JWT_REFRESH_SECRET!,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: { sub: string; username: string; sessionKey: string }) {
    const authHeader = req.get('authorization');

    if (!authHeader) {
      throw new ForbiddenException('Refresh token missing');
    }

    const refreshToken = authHeader.replace('Bearer', '').trim();
    return { ...payload, id: payload.sub, refreshToken };
  }
}
