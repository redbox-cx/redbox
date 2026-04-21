import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable, Logger, MessageEvent, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';
import { Observable, Subscriber } from 'rxjs';

export type MailPushEventType =
  | 'mail.connected'
  | 'mail.heartbeat'
  | 'mail.created'
  | 'mail.updated'
  | 'mail.deleted'
  | 'mail.recalled'
  | 'mail.bulk-updated'
  | 'mail.bulk-deleted';

export type MailPushEvent = {
  type: MailPushEventType;
  mailId?: string;
  mailIds?: string[];
  source?: 'external' | 'internal' | 'user' | 'admin';
  folder?: string;
  isRead?: boolean;
  count?: number;
  reason?: string;
  timestamp?: string;
};

type RedisMailPushEvent = MailPushEvent & {
  userId: string;
  originId: string;
  timestamp: string;
};

const MAIL_EVENTS_CHANNEL = 'redbox:mail-events';

@Injectable()
export class MailEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailEventsService.name);
  private readonly originId = randomUUID();
  private readonly subscribers = new Map<string, Set<Subscriber<MessageEvent>>>();
  private readonly subscriber: Redis;

  constructor(@InjectRedis() private readonly redis: Redis) {
    this.subscriber = this.redis.duplicate();
  }

  async onModuleInit() {
    this.subscriber.on('message', (_channel, payload) => {
      this.deliverRedisEvent(payload);
    });

    await this.subscriber.subscribe(MAIL_EVENTS_CHANNEL);
  }

  onModuleDestroy() {
    this.subscriber.disconnect();
  }

  streamForUser(userId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const userSubscribers = this.subscribers.get(userId) ?? new Set<Subscriber<MessageEvent>>();
      userSubscribers.add(subscriber);
      this.subscribers.set(userId, userSubscribers);

      subscriber.next(this.toMessageEvent({
        userId,
        originId: this.originId,
        type: 'mail.connected',
        timestamp: new Date().toISOString(),
      }));

      const heartbeat = setInterval(() => {
        subscriber.next(this.toMessageEvent({
          userId,
          originId: this.originId,
          type: 'mail.heartbeat',
          timestamp: new Date().toISOString(),
        }));
      }, 30000);

      return () => {
        clearInterval(heartbeat);
        userSubscribers.delete(subscriber);

        if (userSubscribers.size === 0) {
          this.subscribers.delete(userId);
        }
      };
    });
  }

  async emitToUser(userId: string, event: MailPushEvent) {
    const payload: RedisMailPushEvent = {
      ...event,
      userId,
      originId: this.originId,
      timestamp: event.timestamp ?? new Date().toISOString(),
    };

    try {
      await this.redis.publish(MAIL_EVENTS_CHANNEL, JSON.stringify(payload));
    } catch (error) {
      this.logger.error(`Failed to publish mail SSE event for user ${userId}`, error);
    }
  }

  private deliverRedisEvent(payload: string) {
    try {
      const event = JSON.parse(payload) as RedisMailPushEvent;
      const userSubscribers = this.subscribers.get(event.userId);

      if (!userSubscribers || userSubscribers.size === 0) {
        return;
      }

      const message = this.toMessageEvent(event);
      for (const subscriber of userSubscribers) {
        subscriber.next(message);
      }
    } catch (error) {
      this.logger.error('Failed to deliver mail SSE event', error);
    }
  }

  private toMessageEvent(event: RedisMailPushEvent): MessageEvent {
    const { userId, originId, ...data } = event;
    return {
      type: event.type,
      data,
    };
  }
}
