import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { requireEnv } from 'src/common/config/env';

@Injectable()
export class InternalServiceGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const providedSecret = request.headers['x-internal-secret'];

    if (
      !this.isValidSecret(providedSecret, requireEnv('INTERNAL_SERVICE_SECRET'))
    ) {
      throw new UnauthorizedException('Invalid internal service secret');
    }

    return true;
  }

  private isValidSecret(
    input: string | string[] | undefined,
    expected: string,
  ) {
    if (typeof input !== 'string') {
      return false;
    }

    const inputBuffer = Buffer.from(input);
    const expectedBuffer = Buffer.from(expected);

    return (
      inputBuffer.length === expectedBuffer.length &&
      timingSafeEqual(inputBuffer, expectedBuffer)
    );
  }
}
