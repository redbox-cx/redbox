import { useState } from 'react';
import { ReportService } from '../services/ReportService';

interface Props {
    onClose: () => void;
    isPasswordProtected?: boolean;
    knownPassword?: string;
    showPasswordField?: boolean;
}

export function ReportModal({ onClose, isPasswordProtected, knownPassword, showPasswordField }: Props) {
    const [reason, setReason] = useState('');
    const [email, setEmail] = useState('');
    const [contentPassword, setContentPassword] = useState(knownPassword ?? '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const link = window.location.href;
    const shouldShowPasswordField = isPasswordProtected || showPasswordField || !!knownPassword;
    const passwordLocked = shouldShowPasswordField && !!knownPassword;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await ReportService.reportContent({
                link,
                reason,
                ...(email.trim() ? { reporterEmail: email.trim() } : {}),
                ...(contentPassword.trim() ? { contentPassword: contentPassword.trim() } : {}),
            });
            setSubmitted(true);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
            setError(Array.isArray(msg) ? msg[0] : msg || 'Failed to submit report.');
        } finally {
            setLoading(false);
        }
    };

    const canSubmit = !loading && !!reason.trim() && (!isPasswordProtected || !!contentPassword.trim());

    return (
        <div className="settings-modal-overlay" onClick={onClose}>
            <div className="settings-modal" onClick={e => e.stopPropagation()}>
                {submitted ? (
                    <>
                        <div className="settings-modal-icon" style={{ color: 'var(--color-primary)' }}>
                            <i className="bi bi-check-circle-fill" />
                        </div>
                        <h2 className="settings-modal-title">Report Submitted</h2>
                        <p className="settings-modal-desc">
                            Thank you. Our team will review this content.
                        </p>
                        <div className="settings-modal-actions">
                            <button className="settings-modal-cancel" style={{ width: '100%' }} onClick={onClose}>
                                Close
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="settings-modal-icon">
                            <i className="bi bi-flag-fill" />
                        </div>
                        <h2 className="settings-modal-title">Report Content</h2>
                        <p className="settings-modal-desc">
                            Report abusive, illegal, or harmful content. By submitting this report, you grant our team temporary access to the flagged content for review purposes.
                        </p>
                        <form onSubmit={handleSubmit} className="settings-modal-form">
                            <div className="report-link-row">
                                <i className="bi bi-link-45deg" />
                                <span className="report-link-text" title={link}>{link}</span>
                            </div>
                            <textarea
                                className="report-reason-input"
                                placeholder="Describe the issue…"
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                maxLength={2000}
                                rows={4}
                                required
                                disabled={loading}
                            />
                            {shouldShowPasswordField && (
                                <div className="shr-input-wrap">
                                    <i className={`bi bi-${passwordLocked ? 'lock-fill' : 'lock'} shr-input-icon`} />
                                    <input
                                        className="shr-input"
                                        type="password"
                                        placeholder={isPasswordProtected ? 'Content password' : 'Content password (if protected)'}
                                        value={contentPassword}
                                        onChange={e => setContentPassword(e.target.value)}
                                        disabled={loading || passwordLocked}
                                        required={isPasswordProtected}
                                        autoFocus={!passwordLocked}
                                    />
                                </div>
                            )}
                            <div className="shr-input-wrap">
                                <i className="bi bi-envelope shr-input-icon" />
                                <input
                                    className="shr-input"
                                    type="email"
                                    placeholder="Your email (optional)"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    disabled={loading}
                                    maxLength={255}
                                />
                            </div>
                            {error && <p className="settings-error"><i className="bi bi-exclamation-triangle" /> {error}</p>}
                            <div className="settings-modal-actions">
                                <button type="button" className="settings-modal-cancel" onClick={onClose} disabled={loading}>
                                    Cancel
                                </button>
                                <button type="submit" className="settings-modal-confirm" disabled={!canSubmit}>
                                    <i className="bi bi-flag" />
                                    {loading ? 'Submitting…' : 'Submit Report'}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
