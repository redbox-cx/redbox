import { Global, Module } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';

@Global()
@Module({
  providers: [RateLimitGuard, RateLimitService],
  exports: [RateLimitGuard, RateLimitService],
})
export class RateLimitModule {}
