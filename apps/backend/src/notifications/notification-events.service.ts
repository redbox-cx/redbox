import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable, Logger, MessageEvent, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';
import { Observable, Subscriber } from 'rxjs';

export type SystemNotificationPayload = {
  id: string;
  category: string;
  message: string;
  timestamp: string;
  createdAt: string;
  expiresAt: string;
};

type SystemNotificationEvent =
  | {
      type: 'notification.connected' | 'notification.heartbeat';
      timestamp: string;
      originId: string;
    }
  | {
      type: 'notification.snapshot';
      timestamp: string;
      originId: string;
      notifications: SystemNotificationPayload[];
    }
  | {
      type: 'notification.created';
      timestamp: string;
      originId: string;
      notification: SystemNotificationPayload;
    };

const SYSTEM_NOTIFICATIONS_CHANNEL = 'redbox:system-notifications';

@Injectable()
export class NotificationEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationEventsService.name);
  private readonly originId = randomUUID();
  private readonly subscribers = new Set<Subscriber<MessageEvent>>();
  private readonly subscriber: Redis;

  constructor(@InjectRedis() private readonly redis: Redis) {
    this.subscriber = this.redis.duplicate({ enableReadyCheck: false });
  }

  async onModuleInit() {
    this.subscriber.on('message', (_channel, payload) => {
      this.deliverRedisEvent(payload);
    });

    await this.subscriber.subscribe(SYSTEM_NOTIFICATIONS_CHANNEL);
  }

  onModuleDestroy() {
    this.subscriber.disconnect();
  }

  stream(getInitialNotifications: () => Promise<SystemNotificationPayload[]>) {
    return new Observable<MessageEvent>((subscriber) => {
      this.subscribers.add(subscriber);

      subscriber.next(this.toMessageEvent({
        type: 'notification.connected',
        originId: this.originId,
        timestamp: new Date().toISOString(),
      }));

      getInitialNotifications()
        .then((notifications) => {
          subscriber.next(this.toMessageEvent({
            type: 'notification.snapshot',
            originId: this.originId,
            timestamp: new Date().toISOString(),
            notifications,
          }));
        })
        .catch((error) => {
          this.logger.error('Failed to load initial system notifications', error);
        });

      const heartbeat = setInterval(() => {
        subscriber.next(this.toMessageEvent({
          type: 'notification.heartbeat',
          originId: this.originId,
          timestamp: new Date().toISOString(),
        }));
      }, 30000);

      return () => {
        clearInterval(heartbeat);
        this.subscribers.delete(subscriber);
      };
    });
  }

  async emitNotificationCreated(notification: SystemNotificationPayload) {
    const payload: SystemNotificationEvent = {
      type: 'notification.created',
      originId: this.originId,
      timestamp: new Date().toISOString(),
      notification,
    };
    const serializedPayload = JSON.stringify(payload);

    this.deliverRedisEvent(serializedPayload);

    try {
      await this.redis.publish(SYSTEM_NOTIFICATIONS_CHANNEL, serializedPayload);
    } catch (error) {
      this.logger.error('Failed to publish system notification SSE event', error);
    }
  }

  private deliverRedisEvent(payload: string) {
    try {
      const event = JSON.parse(payload) as SystemNotificationEvent;
      const message = this.toMessageEvent(event);

      for (const subscriber of this.subscribers) {
        subscriber.next(message);
      }
    } catch (error) {
      this.logger.error('Failed to deliver system notification SSE event', error);
    }
  }

  private toMessageEvent(event: SystemNotificationEvent): MessageEvent {
    const { originId, ...data } = event;
    return {
      type: event.type,
      data,
    };
  }
}
