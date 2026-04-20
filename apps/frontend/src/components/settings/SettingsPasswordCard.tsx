import { useState } from 'react';
import { AuthService } from '../../services/AuthService';

interface Props {
    onLogout: () => void;
}

export function SettingsPasswordCard({ onLogout }: Props) {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
        setSaving(true);
        try {
            await AuthService.changePassword({ oldPassword, newPassword, newPasswordConfirm: confirmPassword });
            setSuccess('Password changed. You will be logged out.');
            setTimeout(() => onLogout(), 2000);
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setError(Array.isArray(msg) ? msg[0] : msg || 'Failed to change password.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="glass-panel settings-card">
            <h2 className="settings-section-title">
                <i className="bi bi-lock" /> Change Password
            </h2>
            <form className="settings-pw-form" onSubmit={handleSubmit}>
                <div className="shr-input-wrap">
                    <i className="bi bi-lock shr-input-icon" />
                    <input className="shr-input" type="password" placeholder="Current password"
                        value={oldPassword} onChange={e => setOldPassword(e.target.value)} disabled={saving} required />
                </div>
                <div className="shr-input-wrap">
                    <i className="bi bi-lock-fill shr-input-icon" />
                    <input className="shr-input" type="password" placeholder="New password"
                        value={newPassword} onChange={e => setNewPassword(e.target.value)} disabled={saving} required />
                </div>
                <div className="shr-input-wrap">
                    <i className="bi bi-shield-lock shr-input-icon" />
                    <input className="shr-input" type="password" placeholder="Confirm new password"
                        value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={saving} required />
                </div>
                {error && <p className="settings-error"><i className="bi bi-exclamation-triangle" /> {error}</p>}
                {success && <p className="settings-success"><i className="bi bi-check-circle" /> {success}</p>}
                <button className="upload-submit-btn settings-save-btn" type="submit" disabled={saving}>
                    <i className="bi bi-key" />
                    {saving ? 'Saving…' : 'Change Password'}
                </button>
            </form>
        </div>
    );
}
