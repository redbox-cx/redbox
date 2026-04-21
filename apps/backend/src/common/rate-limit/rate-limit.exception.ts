import { HttpException, HttpStatus } from '@nestjs/common';

export class RateLimitExceededException extends HttpException {
  constructor(message: string | Record<string, unknown> = 'Too many requests. Please try again later.') {
    super(
      typeof message === 'string' ? { message } : message,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
