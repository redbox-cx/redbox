import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from 'src/prisma.service';

type JwtPayload = {
  sub: string;
  username: string;
  sessionKey: string;
};

type SseRequest = Request & {
  user?: unknown;
  query: Request['query'] & {
    token?: string;
    access_token?: string;
  };
};

@Injectable()
export class NotificationsSseAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<SseRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET!,
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.sessionKey !== payload.sessionKey) {
      throw new UnauthorizedException('Access Denied (Session Expired)');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Access Denied (Account inactive)');
    }

    request.user = user;
    return true;
  }

  private extractToken(request: SseRequest) {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length);
    }

    return request.query.token ?? request.query.access_token;
  }
}
