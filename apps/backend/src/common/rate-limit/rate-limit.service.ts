import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Request } from 'express';
import { Redis } from 'ioredis';
import { Observable, Subscription } from 'rxjs';
import { getClientIp as resolveTrustedClientIp } from '../http/client-ip';
import type { RateLimitResult, RateLimitRule } from './rate-limit.types';
import { RateLimitExceededException } from './rate-limit.exception';

const DEFAULT_CONCURRENCY_TTL_SECONDS = 2 * 60 * 60;

@Injectable()
export class RateLimitService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  getClientIp(request: Request) {
    return resolveTrustedClientIp(request);
  }

  async consumeRule(rule: RateLimitRule, subject: string): Promise<RateLimitResult> {
    return this.consume(
      this.buildRateLimitKey(rule.name, subject),
      rule.limit,
      rule.windowSeconds,
    );
  }

  async assertAvailable(namespace: string, subject: string, limit: number, windowSeconds: number) {
    const key = this.buildRateLimitKey(namespace, subject);
    const [rawCount, ttl] = await Promise.all([this.redis.get(key), this.redis.ttl(key)]);
    const count = Number(rawCount ?? 0);

    if (count >= limit) {
      throw new RateLimitExceededException({
        message: 'Too many attempts. Please try again later.',
        retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
      });
    }
  }

  async consumeAttempt(namespace: string, subject: string, limit: number, windowSeconds: number) {
    const result = await this.consume(
      this.buildRateLimitKey(namespace, subject),
      limit,
      windowSeconds,
    );

    if (result.remaining < 0) {
      throw new RateLimitExceededException({
        message: 'Too many attempts. Please try again later.',
        retryAfterSeconds: result.ttlSeconds,
      });
    }

    return result;
  }

  async clearAttempts(namespace: string, subject: string) {
    await this.redis.del(this.buildRateLimitKey(namespace, subject));
  }

  trackConcurrentSse<T>(
    source$: Observable<T>,
    options: {
      scope: string;
      userSubject: string;
      userLimit: number;
      ipSubject: string;
      ipLimit: number;
      ttlSeconds?: number;
    },
  ): Observable<T> {
    return new Observable<T>((subscriber) => {
      let acquired = false;
      let sourceSubscription: Subscription | null = null;
      const userKey = this.buildConcurrencyKey(options.scope, 'user', options.userSubject);
      const ipKey = this.buildConcurrencyKey(options.scope, 'ip', options.ipSubject);
      const ttlSeconds = options.ttlSeconds ?? DEFAULT_CONCURRENCY_TTL_SECONDS;

      this.acquireConcurrentKeys([
        { key: userKey, limit: options.userLimit },
        { key: ipKey, limit: options.ipLimit },
      ], ttlSeconds)
        .then(() => {
          acquired = true;
          sourceSubscription = source$.subscribe({
            next: (value) => subscriber.next(value),
            error: (error) => subscriber.error(error),
            complete: () => subscriber.complete(),
          });
        })
        .catch((error) => subscriber.error(error));

      return () => {
        sourceSubscription?.unsubscribe();
        if (acquired) {
          void this.releaseConcurrentKeys([userKey, ipKey]);
        }
      };
    });
  }

  private async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, windowSeconds);
    }

    const ttl = await this.redis.ttl(key);

    return {
      key,
      limit,
      remaining: limit - count,
      ttlSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  }

  private async acquireConcurrentKeys(
    entries: Array<{ key: string; limit: number }>,
    ttlSeconds: number,
  ) {
    const acquiredKeys: string[] = [];

    for (const entry of entries) {
      const count = await this.redis.incr(entry.key);
      if (count === 1) {
        await this.redis.expire(entry.key, ttlSeconds);
      }

      if (count > entry.limit) {
        await this.redis.decr(entry.key);
        await this.releaseConcurrentKeys(acquiredKeys);
        throw new RateLimitExceededException('Too many open event streams');
      }

      acquiredKeys.push(entry.key);
    }
  }

  private async releaseConcurrentKeys(keys: string[]) {
    await Promise.all(
      keys.map(async (key) => {
        const count = await this.redis.decr(key);
        if (count <= 0) {
          await this.redis.del(key);
        }
      }),
    );
  }

  private buildRateLimitKey(namespace: string, subject: string) {
    return `rl:${this.hash(namespace)}:${this.hash(subject)}`;
  }

  private buildConcurrencyKey(scope: string, kind: 'user' | 'ip', subject: string) {
    return `rlcon:${this.hash(scope)}:${kind}:${this.hash(subject)}`;
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex').slice(0, 32);
  }
}
