import {
  BadRequestException,
  CanActivate,
  ConflictException,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';

const UPLOAD_REQUEST_LOCK_SECONDS = 60 * 60;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AuthenticatedRequest = Request & {
  user?: { id?: string; sub?: string };
};

@Injectable()
export class UploadChunkConcurrencyGuard implements CanActivate {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const userId = request.user?.id ?? request.user?.sub;
    const uploadId = request.params.uploadId;

    if (!userId) throw new BadRequestException('Authenticated user is missing');
    if (!UUID_PATTERN.test(uploadId))
      throw new BadRequestException('Invalid Upload ID');

    const lockKey = `upload:request-lock:${userId}:${uploadId}`;
    const token = randomUUID();
    const acquired = await this.redis.set(
      lockKey,
      token,
      'EX',
      UPLOAD_REQUEST_LOCK_SECONDS,
      'NX',
    );

    if (acquired !== 'OK') {
      throw new ConflictException('Another chunk is already being uploaded');
    }

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      void this.redis
        .eval(
          `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`,
          1,
          lockKey,
          token,
        )
        .catch(() => {});
    };

    response.once('finish', release);
    response.once('close', release);
    return true;
  }
}
