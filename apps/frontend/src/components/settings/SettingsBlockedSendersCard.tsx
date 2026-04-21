import { useState, useEffect } from 'react';
import { MailService } from '../../services/MailService';
import { senderColor, senderInitial } from '../mail/mailUtils';

export function SettingsBlockedSendersCard() {
    const [blocked, setBlocked] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [unblocking, setUnblocking] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        MailService.getBlockedSenders()
            .then(setBlocked)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleUnblock = async (email: string) => {
        setUnblocking(email);
        setError('');
        try {
            await MailService.unblockSender(email);
            setBlocked(prev => prev.filter(e => e !== email));
        } catch {
            setError('Failed to unblock. Please try again.');
        } finally {
            setUnblocking(null);
        }
    };

    return (
        <div className="glass-panel settings-card">
            <h2 className="settings-section-title">
                <i className="bi bi-slash-circle" /> Blocked Senders
            </h2>
            {loading ? (
                <p className="settings-profile-since">Loading…</p>
            ) : blocked.length === 0 ? (
                <p className="settings-profile-since" style={{ fontWeight: 400 }}>No blocked senders.</p>
            ) : (
                <div className="blocked-senders-list">
                    {blocked.map(email => (
                        <div key={email} className="blocked-sender-item">
                            <div className="mc-sender-avatar" style={{ background: senderColor(email) }}>
                                {senderInitial(email)}
                            </div>
                            <span className="blocked-sender-email">{email}</span>
                            <button
                                className="copy-icon-btn"
                                title="Unblock"
                                disabled={unblocking === email}
                                onClick={() => handleUnblock(email)}
                            >
                                <i className={`bi bi-${unblocking === email ? 'hourglass-split' : 'person-check'}`} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            {error && <p className="settings-error"><i className="bi bi-exclamation-triangle" /> {error}</p>}
        </div>
    );
}
