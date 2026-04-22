import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import {
  ADMIN_DEFAULT_RATE_LIMIT_METADATA,
  RATE_LIMIT_RULES_METADATA,
} from './rate-limit.decorators';
import { RateLimitService } from './rate-limit.service';
import type { RateLimitRule } from './rate-limit.types';
import { RateLimitExceededException } from './rate-limit.exception';
import { resolveIncomingMailboxUsername } from '../mail/admin-mail-aliases';

const ADMIN_READ_RULE: RateLimitRule = {
  name: 'admin:read',
  limit: 300,
  windowSeconds: 5 * 60,
  subject: 'admin',
};

const ADMIN_WRITE_RULE: RateLimitRule = {
  name: 'admin:write',
  limit: 60,
  windowSeconds: 5 * 60,
  subject: 'admin',
};

type RateLimitRequest = Request & {
  user?: {
    id?: string;
    sub?: string;
  };
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RateLimitRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const rules = this.getRules(context, request);

    if (rules.length === 0) {
      return true;
    }

    for (const rule of rules) {
      const subject = this.resolveSubject(rule, request);
      const result = await this.rateLimitService.consumeRule(rule, subject);

      response.setHeader('X-RateLimit-Limit', String(rule.limit));
      response.setHeader('X-RateLimit-Remaining', String(Math.max(result.remaining, 0)));
      response.setHeader('X-RateLimit-Reset', String(result.ttlSeconds));

      if (result.remaining < 0) {
        response.setHeader('Retry-After', String(result.ttlSeconds));
        throw new RateLimitExceededException({
          message: rule.message ?? 'Too many requests. Please try again later.',
          retryAfterSeconds: result.ttlSeconds,
        });
      }
    }

    return true;
  }

  private getRules(context: ExecutionContext, request: Request): RateLimitRule[] {
    const explicitRules = this.reflector.getAllAndOverride<RateLimitRule[]>(
      RATE_LIMIT_RULES_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (explicitRules) {
      return explicitRules;
    }

    const useAdminDefault = this.reflector.getAllAndOverride<boolean>(
      ADMIN_DEFAULT_RATE_LIMIT_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (!useAdminDefault) {
      return [];
    }

    return request.method === 'GET' ? [ADMIN_READ_RULE] : [ADMIN_WRITE_RULE];
  }

  private resolveSubject(rule: RateLimitRule, request: RateLimitRequest) {
    const ip = this.rateLimitService.getClientIp(request);
    const userId = request.user?.id ?? request.user?.sub ?? 'anonymous';

    if (rule.subject === 'ip') {
      return `ip:${ip}`;
    }

    if (rule.subject === 'user') {
      return `user:${userId}`;
    }

    if (rule.subject === 'admin') {
      return `admin:${userId}`;
    }

    if (rule.subject === 'username-ip') {
      return `username-ip:${this.normalizeValue(request.body?.username)}:${ip}`;
    }

    if (rule.subject === 'param-ip') {
      return `param-ip:${rule.paramName}:${this.normalizeValue(request.params[rule.paramName ?? 'id'])}:${ip}`;
    }

    if (rule.subject === 'param-user') {
      return `param-user:${rule.paramName}:${this.normalizeValue(request.params[rule.paramName ?? 'id'])}:${userId}`;
    }

    if (rule.subject === 'mail-recipient') {
      return `mail-recipient:${resolveIncomingMailboxUsername(request.body?.to)}`;
    }

    return `unknown:${ip}`;
  }

  private normalizeValue(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : 'unknown';
  }
}
