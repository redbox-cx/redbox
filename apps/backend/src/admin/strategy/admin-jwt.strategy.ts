import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/prisma.service';
import { requireEnv } from 'src/common/config/env';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(private readonly prismaService: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireEnv('ADMIN_JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: { sub: string; username: string; sessionKey: string }) {
    const adminUser = await this.prismaService.adminUser.findUnique({
      where: { id: payload.sub },
    });

    if (!adminUser || adminUser.sessionKey !== payload.sessionKey) {
      throw new UnauthorizedException('Access Denied (Session Expired)');
    }

    return adminUser;
  }
}
