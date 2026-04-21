import { useState } from 'react';
import { UserService } from '../../services/UserService';

interface Props {
    onLogout: () => void;
}

export function SettingsDeleteCard({ onLogout }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const openModal = () => { setPassword(''); setError(''); setModalOpen(true); };
    const closeModal = () => { setModalOpen(false); setPassword(''); setError(''); };

    const handleDelete = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await UserService.deleteAccount(password);
            onLogout();
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setError(Array.isArray(msg) ? msg[0] : msg || 'Incorrect password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="glass-panel settings-card">
                <h2 className="settings-section-title">
                    <i className="bi bi-trash3" style={{ color: 'var(--color-primary)' }} /> Delete Account
                </h2>
                <p className="settings-profile-since" style={{ margin: 0, fontWeight: 400 }}>
                    This will schedule your account for permanent deletion. You will have a grace period to log back in and cancel. All your files, mails, links, and bins will be removed.
                </p>
                <button className="settings-delete-btn" onClick={openModal}>
                    <i className="bi bi-trash3" /> Delete my account
                </button>
            </div>

            {modalOpen && (
                <div className="settings-modal-overlay" onClick={closeModal}>
                    <div className="settings-modal" onClick={e => e.stopPropagation()}>
                        <div className="settings-modal-icon">
                            <i className="bi bi-exclamation-triangle-fill" />
                        </div>
                        <h2 className="settings-modal-title">Delete Account</h2>
                        <p className="settings-modal-desc">
                            Your account will be <strong>permanently deleted</strong> after a grace period. You can cancel by logging in again before it expires. This includes all your files, mails, links, and bins.
                        </p>
                        <form onSubmit={handleDelete} className="settings-modal-form">
                            <div className="shr-input-wrap">
                                <i className="bi bi-lock shr-input-icon" />
                                <input
                                    className="shr-input"
                                    type="password"
                                    placeholder="Enter your password to confirm"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    disabled={loading}
                                    required
                                    autoFocus
                                />
                            </div>
                            {error && <p className="settings-error"><i className="bi bi-exclamation-triangle" /> {error}</p>}
                            <div className="settings-modal-actions">
                                <button type="button" className="settings-modal-cancel" onClick={closeModal} disabled={loading}>
                                    Cancel
                                </button>
                                <button type="submit" className="settings-modal-confirm" disabled={loading || !password}>
                                    <i className="bi bi-trash3" />
                                    {loading ? 'Deleting…' : 'Delete Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
