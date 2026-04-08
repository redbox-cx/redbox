import { useState, useEffect } from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { useAuth } from '../context/AuthContext';
import { UserService } from '../services/UserService';
import { AuthService } from '../services/AuthService';
import { getAvatarSrc, AVATAR_LIST } from '../config/avatars';

export function Settings() {
    const { user, updateUser, logout } = useAuth();

    // Avatar
    const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar ?? '');
    const [avatarSaving, setAvatarSaving] = useState(false);
    const [avatarSuccess, setAvatarSuccess] = useState(false);
    const [avatarError, setAvatarError] = useState('');

    // Password
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwSaving, setPwSaving] = useState(false);
    const [pwSuccess, setPwSuccess] = useState('');
    const [pwError, setPwError] = useState('');

    useEffect(() => {
        document.documentElement.classList.add('dash-page');
        return () => { document.documentElement.classList.remove('dash-page'); };
    }, []);

    const handleAvatarSave = async () => {
        if (!selectedAvatar || selectedAvatar === user?.avatar) return;
        setAvatarSaving(true);
        setAvatarError('');
        setAvatarSuccess(false);
        try {
            const result = await UserService.updateAvatar(selectedAvatar);
            updateUser({ avatar: result.avatar });
            setAvatarSuccess(true);
            setTimeout(() => setAvatarSuccess(false), 2500);
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setAvatarError(Array.isArray(msg) ? msg[0] : msg || 'Failed to update avatar.');
        } finally {
            setAvatarSaving(false);
        }
    };

    const handlePasswordSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwError('');
        setPwSuccess('');
        if (newPassword !== confirmPassword) {
            setPwError('Passwords do not match.');
            return;
        }
        setPwSaving(true);
        try {
            await AuthService.changePassword({ oldPassword, newPassword, newPasswordConfirm: confirmPassword });
            setPwSuccess('Password changed. You will be logged out.');
            setTimeout(() => { logout(); }, 2000);
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setPwError(Array.isArray(msg) ? msg[0] : msg || 'Failed to change password.');
        } finally {
            setPwSaving(false);
        }
    };

    const memberSince = user?.createdAt
        ? new Date(user.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

    return (
        <div className="dash-layout">
            <div className="blob blob-1" />
            <div className="blob blob-2" />
            <TopBar />

            <main className="settings-container">
                <h1 className="dash-greeting">Settings</h1>

                <div className="settings-grid">
                    <div className="glass-panel settings-card settings-profile-card">
                        <div className="settings-profile-avatar">
                            <img
                                src={getAvatarSrc(user?.avatar ?? '')}
                                alt="avatar"
                                className="settings-big-avatar"
                            />
                        </div>
                        <div className="settings-profile-info">
                            <p className="settings-profile-username">{user?.username}</p>
                            <p className="settings-profile-since">Member since {memberSince}</p>
                        </div>
                    </div>
                    <div className="glass-panel settings-card">
                        <h2 className="settings-section-title">
                            <i className="bi bi-person-circle" /> Profile Picture
                        </h2>
                        <div className="settings-avatar-grid">
                            {AVATAR_LIST.map(({ key, src }) => (
                                <button
                                    key={key}
                                    type="button"
                                    className={`settings-avatar-btn ${selectedAvatar === key ? 'selected' : ''}`}
                                    onClick={() => setSelectedAvatar(key)}
                                >
                                    <img src={src} alt={key} />
                                    {selectedAvatar === key && (
                                        <span className="settings-avatar-check">
                                            <i className="bi bi-check-lg" />
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                        {avatarError && <p className="settings-error"><i className="bi bi-exclamation-triangle" /> {avatarError}</p>}
                        <button
                            className="upload-submit-btn settings-save-btn"
                            onClick={handleAvatarSave}
                            disabled={avatarSaving || !selectedAvatar || selectedAvatar === user?.avatar}
                        >
                            <i className={`bi bi-${avatarSuccess ? 'check-lg' : 'person-check'}`} />
                            {avatarSaving ? 'Saving…' : avatarSuccess ? 'Saved!' : 'Save Avatar'}
                        </button>
                    </div>
                    <div className="glass-panel settings-card">
                        <h2 className="settings-section-title">
                            <i className="bi bi-lock" /> Change Password
                        </h2>
                        <form className="settings-pw-form" onSubmit={handlePasswordSave}>
                            <div className="shr-input-wrap">
                                <i className="bi bi-lock shr-input-icon" />
                                <input
                                    className="shr-input"
                                    type="password"
                                    placeholder="Current password"
                                    value={oldPassword}
                                    onChange={e => setOldPassword(e.target.value)}
                                    disabled={pwSaving}
                                    required
                                />
                            </div>
                            <div className="shr-input-wrap">
                                <i className="bi bi-lock-fill shr-input-icon" />
                                <input
                                    className="shr-input"
                                    type="password"
                                    placeholder="New password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    disabled={pwSaving}
                                    required
                                />
                            </div>
                            <div className="shr-input-wrap">
                                <i className="bi bi-shield-lock shr-input-icon" />
                                <input
                                    className="shr-input"
                                    type="password"
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    disabled={pwSaving}
                                    required
                                />
                            </div>
                            {pwError && <p className="settings-error"><i className="bi bi-exclamation-triangle" /> {pwError}</p>}
                            {pwSuccess && <p className="settings-success"><i className="bi bi-check-circle" /> {pwSuccess}</p>}
                            <button
                                className="upload-submit-btn settings-save-btn"
                                type="submit"
                                disabled={pwSaving}
                            >
                                <i className="bi bi-key" />
                                {pwSaving ? 'Saving…' : 'Change Password'}
                            </button>
                        </form>
                    </div>

                </div>
            </main>
        </div>
    );
}
