import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export interface SystemNotification {
    id: string;
    category: 'info' | 'warning' | 'error' | 'success' | 'maintenance';
    message: string;
    timestamp: string;
    createdAt: string;
    expiresAt: string;
}

export function useSystemNotifications() {
    const { isAuthenticated } = useAuth();
    const [notifications, setNotifications] = useState<SystemNotification[]>([]);

    const dismiss = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;

        const token = localStorage.getItem('access_token');
        if (!token) return;

        const base = import.meta.env.VITE_API_URL as string;
        const es = new EventSource(`${base}/notifications/events?token=${encodeURIComponent(token)}`);

        es.addEventListener('notification.snapshot', (e: MessageEvent) => {
            const data = JSON.parse(e.data);
            const now = new Date();
            const active = (data.notifications as SystemNotification[]).filter(
                n => new Date(n.expiresAt) > now
            );
            setNotifications(active);
        });

        es.addEventListener('notification.created', (e: MessageEvent) => {
            const data = JSON.parse(e.data);
            const n: SystemNotification = data.notification;
            if (new Date(n.expiresAt) > new Date()) {
                setNotifications(prev => [n, ...prev]);
            }
        });

        return () => es.close();
    }, [isAuthenticated]);

    // Auto-remove expired notifications
    useEffect(() => {
        if (notifications.length === 0) return;
        const nearest = notifications.reduce((min, n) => {
            const t = new Date(n.expiresAt).getTime();
            return t < min ? t : min;
        }, Infinity);
        const delay = nearest - Date.now();
        if (delay <= 0) {
            setNotifications(prev => prev.filter(n => new Date(n.expiresAt) > new Date()));
            return;
        }
        const timer = setTimeout(() => {
            setNotifications(prev => prev.filter(n => new Date(n.expiresAt) > new Date()));
        }, delay);
        return () => clearTimeout(timer);
    }, [notifications]);

    return { notifications, dismiss };
}
