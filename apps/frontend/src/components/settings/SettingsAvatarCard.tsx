import { useState } from 'react';
import { AVATAR_LIST } from '../../config/avatars';
import { UserService } from '../../services/UserService';

interface Props {
    currentAvatar?: string;
    onSaved: (avatar: string) => void;
}

export function SettingsAvatarCard({ currentAvatar, onSaved }: Props) {
    const [selected, setSelected] = useState(currentAvatar ?? '');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!selected || selected === currentAvatar) return;
        setSaving(true);
        setError('');
        setSuccess(false);
        try {
            const result = await UserService.updateAvatar(selected);
            onSaved(result.avatar);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 2500);
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setError(Array.isArray(msg) ? msg[0] : msg || 'Failed to update avatar.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="glass-panel settings-card">
            <h2 className="settings-section-title">
                <i className="bi bi-person-circle" /> Profile Picture
            </h2>
            <div className="settings-avatar-grid">
                {AVATAR_LIST.map(({ key, src }) => (
                    <button
                        key={key}
                        type="button"
                        className={`settings-avatar-btn ${selected === key ? 'selected' : ''}`}
                        onClick={() => setSelected(key)}
                    >
                        <img src={src} alt={key} />
                        {selected === key && (
                            <span className="settings-avatar-check"><i className="bi bi-check-lg" /></span>
                        )}
                    </button>
                ))}
            </div>
            {error && <p className="settings-error"><i className="bi bi-exclamation-triangle" /> {error}</p>}
            <button
                className="upload-submit-btn settings-save-btn"
                onClick={handleSave}
                disabled={saving || !selected || selected === currentAvatar}
            >
                <i className={`bi bi-${success ? 'check-lg' : 'person-check'}`} />
                {saving ? 'Saving…' : success ? 'Saved!' : 'Save Avatar'}
            </button>
        </div>
    );
}
