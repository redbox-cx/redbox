import { AnimatePresence, motion } from 'motion/react';
import { useSystemNotifications, type SystemNotification } from '../../hooks/useSystemNotifications';
import { useRateLimitNotifications } from '../../hooks/useRateLimitNotifications';
import './SystemNotificationToast.css';

const CATEGORY = {
    info:        { icon: 'bi-info-circle-fill' },
    warning:     { icon: 'bi-exclamation-triangle-fill' },
    error:       { icon: 'bi-x-circle-fill' },
    success:     { icon: 'bi-check-circle-fill' },
    maintenance: { icon: 'bi-tools' },
} satisfies Record<SystemNotification['category'], { icon: string }>;

export function SystemNotificationToast() {
    const { notifications, dismiss } = useSystemNotifications();
    const { notifications: rateLimitNotifications, dismiss: dismissRateLimit } = useRateLimitNotifications();
    const toasts = [
        ...rateLimitNotifications.map(n => ({ ...n, source: 'rate-limit' as const })),
        ...notifications.map(n => ({ ...n, source: 'system' as const })),
    ];

    return (
        <div className="sys-notif-container">
            <AnimatePresence initial={false}>
                {toasts.map(n => (
                    <motion.div
                        key={n.id}
                        className={`sys-notif-toast sys-notif-${n.category}`}
                        initial={{ opacity: 0, x: 80, scale: 0.92 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 80, scale: 0.92 }}
                        transition={{ duration: 0.28, ease: 'easeOut' }}
                        layout
                    >
                        <i className={`bi ${CATEGORY[n.category]?.icon ?? 'bi-info-circle-fill'} sys-notif-icon`} />
                        <span className="sys-notif-message">{n.message}</span>
                        <button
                            className="sys-notif-close"
                            onClick={() => n.source === 'rate-limit' ? dismissRateLimit(n.id) : dismiss(n.id)}
                            aria-label="Dismiss"
                        >
                            <i className="bi bi-x" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
