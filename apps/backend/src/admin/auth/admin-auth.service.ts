import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma.service';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AdminChangePasswordDto, AdminLoginDto } from '../dto/auth.dto';
import { AuditActorType } from '@prisma/client';

type AdminLoginAuditContext = {
  ipAddress: string | null;
  ipSource: string | null;
  userAgent: string | null;
  forwardedFor: string | null;
  cfRay: string | null;
};

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async getTokens(adminId: string, username: string, sessionKey: string) {
    const payload = { sub: adminId, username, sessionKey };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.ADMIN_JWT_ACCESS_SECRET ?? process.env.JWT_ACCESS_SECRET,
        expiresIn: (process.env.ADMIN_EXPIRES_IN_ACCESS ?? process.env.EXPIRES_IN_ACCESS ?? '5m') as never,
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.ADMIN_JWT_REFRESH_SECRET ?? process.env.JWT_REFRESH_SECRET,
        expiresIn: (process.env.ADMIN_EXPIRES_IN_REFRESH ?? process.env.EXPIRES_IN_REFRESH ?? '1d') as never,
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async login(dto: AdminLoginDto, auditContext: AdminLoginAuditContext) {
    const adminUser = await this.prismaService.adminUser.findUnique({
      where: { username: dto.username },
    });

    if (!adminUser) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, adminUser.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    await this.prismaService.adminAuditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        adminUserId: adminUser.id,
        action: 'admin_login',
        reason: 'Admin logged in',
        meta: {
          username: adminUser.username,
          ipAddress: auditContext.ipAddress,
          ipSource: auditContext.ipSource,
          userAgent: auditContext.userAgent,
          forwardedFor: auditContext.forwardedFor,
          cfRay: auditContext.cfRay,
        },
      },
    });

    return this.getTokens(adminUser.id, adminUser.username, adminUser.sessionKey);
  }

  async refreshToken(adminId: string, keyFromToken: string) {
    const newSessionKey = randomUUID();
    const result = await this.prismaService.adminUser.updateMany({
      where: { id: adminId, sessionKey: keyFromToken },
      data: { sessionKey: newSessionKey },
    });

    if (result.count === 0) {
      throw new ForbiddenException('Access Denied (Session invalid)');
    }

    const updatedAdmin = await this.prismaService.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!updatedAdmin) {
      throw new ForbiddenException('Access Denied (Admin not found)');
    }

    return this.getTokens(updatedAdmin.id, updatedAdmin.username, updatedAdmin.sessionKey);
  }

  async logout(adminId: string) {
    await this.prismaService.adminUser.update({
      where: { id: adminId },
      data: { sessionKey: randomUUID() },
    });

    return { message: 'Logged out successfully' };
  }

  async changePassword(adminId: string, dto: AdminChangePasswordDto) {
    const adminUser = await this.prismaService.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!adminUser) {
      throw new ForbiddenException('Admin not found');
    }

    const isOldPasswordValid = await bcrypt.compare(dto.oldPassword, adminUser.passwordHash);
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Old password incorrect');
    }

    await this.prismaService.adminUser.update({
      where: { id: adminId },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, 13),
        sessionKey: randomUUID(),
      },
    });

    return { message: 'Password successfully changed. Please log in again.' };
  }
}
