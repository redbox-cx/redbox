import { useCallback, useEffect, useState } from 'react';

export interface RateLimitNotification {
    id: string;
    category: 'warning';
    message: string;
    createdAt: string;
}

type RateLimitNotificationDetail = {
    message?: string;
    retryAfterSeconds?: number;
};

const RATE_LIMIT_EVENT = 'redbox:rate-limit-reached';
const TOAST_TTL_MS = 8000;
const EMIT_THROTTLE_MS = 2500;

let lastEmittedAt = 0;

function createId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatRateLimitMessage(retryAfterSeconds?: number) {
    if (retryAfterSeconds && retryAfterSeconds > 0) {
        return `Rate limit reached. Try again in ${retryAfterSeconds}s.`;
    }

    return 'Rate limit reached. Please wait a moment and try again.';
}

export function emitRateLimitNotification(detail: RateLimitNotificationDetail = {}) {
    if (typeof window === 'undefined') return;

    const now = Date.now();
    if (now - lastEmittedAt < EMIT_THROTTLE_MS) {
        return;
    }
    lastEmittedAt = now;

    window.dispatchEvent(new CustomEvent<RateLimitNotification>(RATE_LIMIT_EVENT, {
        detail: {
            id: createId(),
            category: 'warning',
            message: detail.message ?? formatRateLimitMessage(detail.retryAfterSeconds),
            createdAt: new Date().toISOString(),
        },
    }));
}

export function useRateLimitNotifications() {
    const [notifications, setNotifications] = useState<RateLimitNotification[]>([]);

    const dismiss = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    useEffect(() => {
        const onRateLimit = (event: Event) => {
            const notification = (event as CustomEvent<RateLimitNotification>).detail;
            if (!notification) return;

            setNotifications(prev => [notification, ...prev].slice(0, 3));
        };

        window.addEventListener(RATE_LIMIT_EVENT, onRateLimit);
        return () => window.removeEventListener(RATE_LIMIT_EVENT, onRateLimit);
    }, []);

    useEffect(() => {
        if (notifications.length === 0) return;

        const timers = notifications.map(notification => {
            const age = Date.now() - new Date(notification.createdAt).getTime();
            return window.setTimeout(() => {
                dismiss(notification.id);
            }, Math.max(TOAST_TTL_MS - age, 0));
        });

        return () => timers.forEach(timer => window.clearTimeout(timer));
    }, [dismiss, notifications]);

    return { notifications, dismiss };
}
