import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createDecipheriv, scrypt } from 'crypto';
import { Redis } from 'ioredis';
import { requireEnv } from 'src/common/config/env';
import { PrismaService } from 'src/prisma.service';
import { UsersService } from 'src/users/users.service';
import { promisify } from 'util';
import { AuthService } from '../auth.service';
import {
  InternalLoginDto,
  InternalProfileDto,
  InternalValidateDto,
} from './internal-auth.dto';

const scryptAsync = promisify(scrypt);

const internalSessionUserSelect = {
  id: true,
  username: true,
  status: true,
  sessionKey: true,
} as const satisfies Prisma.UserSelect;

const internalProfileUserSelect = {
  id: true,
  username: true,
  avatar: true,
  createdAt: true,
  status: true,
} as const satisfies Prisma.UserSelect;

const internalLoginUserSelect = {
  ...internalSessionUserSelect,
  password: true,
  encryptedMasterKey: true,
  masterKeyIv: true,
  masterKeySalt: true,
} as const satisfies Prisma.UserSelect;

type InternalSessionUser = Prisma.UserGetPayload<{
  select: typeof internalSessionUserSelect;
}>;
type InternalProfileUser = Prisma.UserGetPayload<{
  select: typeof internalProfileUserSelect;
}>;
type InternalLoginUser = Prisma.UserGetPayload<{
  select: typeof internalLoginUserSelect;
}>;

type InternalAccessTokenPayload = {
  sub: string;
  username: string;
  sessionKey: string;
};

@Injectable()
export class InternalAuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async login(dto: InternalLoginDto) {
    const user = await this.prismaService.user.findUnique({
      where: { username: dto.username },
      select: internalLoginUserSelect,
    });

    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid username or password');
    }

    await this.usersService.assertUserCanLogin(user);

    const authenticatedUser = await this.prismaService.user.findUnique({
      where: { id: user.id },
      select: internalLoginUserSelect,
    });

    if (!authenticatedUser) {
      throw new UnauthorizedException('Invalid username or password');
    }

    await this.usersService.assertUserCanLogin(authenticatedUser);

    const masterKey = await this.decryptMasterKey(
      dto.password,
      authenticatedUser,
    );
    await this.redis.set(
      `masterkey:${authenticatedUser.id}`,
      masterKey.toString('hex'),
      'EX',
      86400,
    );

    return this.authService.getTokens(
      authenticatedUser.id,
      authenticatedUser.username,
      authenticatedUser.sessionKey,
    );
  }

  async validate(dto: InternalValidateDto) {
    let payload: InternalAccessTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<InternalAccessTokenPayload>(
        dto.token,
        {
          secret: requireEnv('JWT_ACCESS_SECRET'),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: payload.sub },
      select: internalSessionUserSelect,
    });

    if (
      !user ||
      user.username !== payload.username ||
      user.sessionKey !== payload.sessionKey
    ) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    await this.usersService.assertUserCanLogin(user);

    return {
      valid: true,
      user: this.toInternalSessionUser(user),
    };
  }

  async profile(dto: InternalProfileDto) {
    const user = await this.prismaService.user.findUnique({
      where: { id: dto.userId },
      select: internalProfileUserSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersService.assertUserCanLogin(user);

    return this.toInternalProfileUser(user);
  }

  private async decryptMasterKey(password: string, user: InternalLoginUser) {
    if (!user.encryptedMasterKey || !user.masterKeyIv || !user.masterKeySalt) {
      throw new ForbiddenException('User master key unavailable');
    }

    const derivedKey = (await scryptAsync(
      password,
      Buffer.from(user.masterKeySalt, 'hex'),
      32,
    )) as Buffer;
    const decipher = createDecipheriv(
      'aes-256-cbc',
      derivedKey,
      Buffer.from(user.masterKeyIv, 'hex'),
    );
    let decrypted = decipher.update(
      Buffer.from(user.encryptedMasterKey, 'hex'),
    );
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
  }

  private toInternalSessionUser(user: InternalSessionUser) {
    return {
      id: user.id,
      username: user.username,
      sessionKey: user.sessionKey,
    };
  }

  private toInternalProfileUser(user: InternalProfileUser) {
    return {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      createdAt: user.createdAt,
    };
  }
}
