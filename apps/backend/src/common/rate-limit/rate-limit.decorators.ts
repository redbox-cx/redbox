import { SetMetadata } from '@nestjs/common';
import type { RateLimitRule } from './rate-limit.types';

export const RATE_LIMIT_RULES_METADATA = 'redbox:rate-limit-rules';
export const ADMIN_DEFAULT_RATE_LIMIT_METADATA = 'redbox:admin-default-rate-limit';

export const RateLimit = (...rules: RateLimitRule[]) =>
  SetMetadata(RATE_LIMIT_RULES_METADATA, rules);

export const AdminDefaultRateLimit = () =>
  SetMetadata(ADMIN_DEFAULT_RATE_LIMIT_METADATA, true);
