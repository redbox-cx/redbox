import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(private readonly prismaService: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.ADMIN_JWT_ACCESS_SECRET ?? process.env.JWT_ACCESS_SECRET!,
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
