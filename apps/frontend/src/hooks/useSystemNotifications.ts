import { useEffect, useState, useCallback } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/apiClient';

export interface SystemNotification {
    id: string;
    category: 'info' | 'warning' | 'error' | 'success' | 'maintenance';
    message: string;
    timestamp: string;
    createdAt: string;
    expiresAt: string;
}

const STORAGE_KEY = 'dismissed_notifications';

function getDismissed(): Set<string> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch {
        return new Set();
    }
}

function saveDismissed(ids: Set<string>) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

function notificationTime(notification: SystemNotification) {
    return new Date(notification.createdAt || notification.timestamp).getTime();
}

function filterVisibleNotifications(items: SystemNotification[]) {
    const dismissed = getDismissed();
    const now = new Date();

    return items.filter(n => new Date(n.expiresAt) > now && !dismissed.has(n.id));
}

function mergeVisibleNotifications(current: SystemNotification[], incoming: SystemNotification[]) {
    const byId = new Map<string, SystemNotification>();

    for (const notification of filterVisibleNotifications(current)) {
        byId.set(notification.id, notification);
    }

    for (const notification of filterVisibleNotifications(incoming)) {
        byId.set(notification.id, notification);
    }

    return [...byId.values()].sort((a, b) => notificationTime(b) - notificationTime(a));
}

type NotificationStreamMessage = {
    type?: string;
    notifications?: SystemNotification[];
    notification?: SystemNotification;
};

export function useSystemNotifications() {
    const { isAuthenticated } = useAuth();
    const [notifications, setNotifications] = useState<SystemNotification[]>([]);

    const dismiss = useCallback((id: string) => {
        const dismissed = getDismissed();
        dismissed.add(id);
        saveDismissed(dismissed);
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        const baseUrl = import.meta.env.VITE_API_URL as string;
        const ctrl = new AbortController();
        let closed = false;
        let reconnectTimer: number | null = null;

        const loadActiveNotifications = async () => {
            try {
                const response = await apiClient.get('/notifications');
                if (closed) return;

                const items = (response.data?.result ?? []) as SystemNotification[];
                setNotifications(prev => mergeVisibleNotifications(prev, items));
            } catch {
                return;
            }
        };

        const scheduleReconnect = (delayMs = 3000) => {
            if (closed || ctrl.signal.aborted || reconnectTimer !== null) return;

            reconnectTimer = window.setTimeout(() => {
                reconnectTimer = null;
                connectStream();
            }, delayMs);
        };

        const connectStream = () => {
            const token = localStorage.getItem('access_token');
            if (!token || closed) return;

            fetchEventSource(`${baseUrl}/notifications/events`, {
                headers: { Authorization: `Bearer ${token}` },
                signal: ctrl.signal,
                openWhenHidden: true,
                onmessage(event) {
                    if (!event.data) return;

                    let data: NotificationStreamMessage;
                    try {
                        data = JSON.parse(event.data) as NotificationStreamMessage;
                    } catch {
                        return;
                    }

                    const eventType = event.event || data.type;
                    if (!eventType) return;

                    if (eventType === 'notification.snapshot') {
                        setNotifications(prev => mergeVisibleNotifications(prev, data.notifications ?? []));
                        return;
                    }

                    if (eventType === 'notification.created') {
                        const n: SystemNotification | undefined = data.notification;
                        if (!n) return;

                        setNotifications(prev => mergeVisibleNotifications(prev, [n]));
                    }
                },
                async onopen(response) {
                    if (response.ok) {
                        return;
                    }

                    throw new Error(`System notification stream failed with ${response.status}`);
                },
                onerror(error) {
                    throw error;
                },
            }).catch(() => {
                if (closed || ctrl.signal.aborted) return;

                void loadActiveNotifications().finally(() => scheduleReconnect());
            });
        };

        connectStream();
        void loadActiveNotifications();

        return () => {
            closed = true;
            if (reconnectTimer !== null) {
                window.clearTimeout(reconnectTimer);
            }
            ctrl.abort();
        };
    }, [isAuthenticated]);

    // Auto-remove expired notifications
    useEffect(() => {
        if (notifications.length === 0) return;
        const nearest = notifications.reduce((min, n) => {
            const t = new Date(n.expiresAt).getTime();
            return t < min ? t : min;
        }, Infinity);
        const delay = nearest - Date.now();
        const timer = setTimeout(() => {
            setNotifications(prev => prev.filter(n => new Date(n.expiresAt) > new Date()));
        }, Math.max(delay, 0));
        return () => clearTimeout(timer);
    }, [notifications]);

    return { notifications, dismiss };
}
