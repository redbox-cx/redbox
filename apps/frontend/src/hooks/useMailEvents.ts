import { useEffect, useRef } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';

type MailEventType =
    | 'mail.connected'
    | 'mail.heartbeat'
    | 'mail.created'
    | 'mail.updated'
    | 'mail.deleted'
    | 'mail.recalled'
    | 'mail.bulk-updated'
    | 'mail.bulk-deleted';

const REFRESH_EVENTS: MailEventType[] = [
    'mail.created',
    'mail.updated',
    'mail.deleted',
    'mail.recalled',
    'mail.bulk-updated',
    'mail.bulk-deleted',
];

export function useMailEvents(onRefresh: () => void) {
    const onRefreshRef = useRef(onRefresh);
    onRefreshRef.current = onRefresh;

    useEffect(() => {
        let ctrl: AbortController | null = null;

        const connect = () => {
            const token = localStorage.getItem('access_token');
            if (!token) return;

            ctrl = new AbortController();
            const baseUrl = import.meta.env.VITE_API_URL as string;

            fetchEventSource(`${baseUrl}/mail/events`, {
                headers: { Authorization: `Bearer ${token}` },
                signal: ctrl.signal,
                openWhenHidden: true,
                onmessage(event) {
                    let eventType: string = event.event;
                    if (!eventType && event.data) {
                        try { eventType = JSON.parse(event.data).type; } catch {}
                    }
                    if (REFRESH_EVENTS.includes(eventType as MailEventType)) {
                        onRefreshRef.current();
                    }
                },
                async onopen(response) {
                    if (response.status === 401 || response.status === 404) {
                        ctrl?.abort();
                    }
                },
                onerror() {
                },
            }).catch(() => {});
        };

        connect();
        const poll = setInterval(() => {
            if (!ctrl && localStorage.getItem('access_token')) connect();
        }, 500);

        return () => {
            clearInterval(poll);
            ctrl?.abort();
        };
    }, []);
}
