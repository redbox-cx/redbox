import { useState, useEffect } from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { useAuth } from '../context/AuthContext';
import { UserService, type InviteCode } from '../services/UserService';
import { AuthService } from '../services/AuthService';
import { getAvatarSrc, AVATAR_LIST } from '../config/avatars';

export function Settings() {
    const { user, updateUser, logout } = useAuth();

    // Avatar
    const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar ?? '');
    const [avatarSaving, setAvatarSaving] = useState(false);
    const [avatarSuccess, setAvatarSuccess] = useState(false);
    const [avatarError, setAvatarError] = useState('');

    // Invites
    const [invites, setInvites] = useState<InviteCode[]>([]);
    const [invitesLoading, setInvitesLoading] = useState(true);
    const [inviteGenerating, setInviteGenerating] = useState(false);
    const [inviteError, setInviteError] = useState('');
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [revealedCodes, setRevealedCodes] = useState<Set<string>>(new Set());

    // Password
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwSaving, setPwSaving] = useState(false);
    const [pwSuccess, setPwSuccess] = useState('');
    const [pwError, setPwError] = useState('');

    // Delete account
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    useEffect(() => {
        document.documentElement.classList.add('dash-page', 'settings-page');
        return () => { document.documentElement.classList.remove('dash-page', 'settings-page'); };
    }, []);

    useEffect(() => {
        UserService.getInvites()
            .then(setInvites)
            .catch(() => {})
            .finally(() => setInvitesLoading(false));
    }, []);

    const handleGenerateInvite = async () => {
        setInviteError('');
        setInviteGenerating(true);
        try {
            const code = await UserService.generateInvite();
            setInvites(prev => [...prev, code]);
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setInviteError(Array.isArray(msg) ? msg[0] : msg || 'Failed to generate invite.');
        } finally {
            setInviteGenerating(false);
        }
    };

    const copyCode = (code: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 1500);
    };

    const toggleReveal = (code: string) => {
        setRevealedCodes(prev => {
            const next = new Set(prev);
            next.has(code) ? next.delete(code) : next.add(code);
            return next;
        });
    };

    const atInviteLimit = invites.length >= 2;

    const openDeleteModal = () => { setDeletePassword(''); setDeleteError(''); setDeleteModalOpen(true); };
    const closeDeleteModal = () => { setDeleteModalOpen(false); setDeletePassword(''); setDeleteError(''); };

    const handleDeleteAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setDeleteError('');
        setDeleteLoading(true);
        try {
            await UserService.deleteAccount(deletePassword);
            logout();
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setDeleteError(Array.isArray(msg) ? msg[0] : msg || 'Incorrect password.');
        } finally {
            setDeleteLoading(false);
        }
    };

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

                    <div className="glass-panel settings-card">
                        <h2 className="settings-section-title">
                            <i className="bi bi-person-plus-fill" /> Invite Codes
                        </h2>
                        {invitesLoading ? (
                            <p className="settings-profile-since">Loading…</p>
                        ) : invites.length === 0 ? (
                            <p className="settings-profile-since">No invite codes yet.</p>
                        ) : (
                            <div className="links-stack">
                                {invites.map(inv => {
                                    const used = 1 - inv.usage;
                                    const isSpent = inv.usage === 0;
                                    const isRevealed = revealedCodes.has(inv.code);
                                    return (
                                        <div key={inv.code} className={`link-item ${isRevealed ? 'revealed' : ''}${isSpent ? ' invite-spent' : ''}`}>
                                            {!isRevealed && (
                                                <div className="link-blur-overlay" onClick={() => toggleReveal(inv.code)}>
                                                    Click to unblur
                                                </div>
                                            )}
                                            <div className="link-content">
                                                <span className="link-res">{inv.code}</span>
                                                <span className="link-orig">{used}/1 used</span>
                                            </div>
                                            <div className="link-actions">
                                                <button
                                                    className={`copy-icon-btn ${copiedCode === inv.code ? 'copied' : ''}`}
                                                    onClick={(e) => copyCode(inv.code, e)}
                                                    title="Copy"
                                                >
                                                    <i className={`bi bi-${copiedCode === inv.code ? 'check-lg' : 'copy'}`} />
                                                </button>
                                                <button className="reblur-btn" onClick={() => toggleReveal(inv.code)} title="Blur">
                                                    <i className="bi bi-eye-slash" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {inviteError && <p className="settings-error"><i className="bi bi-exclamation-triangle" /> {inviteError}</p>}
                        <button
                            className="upload-submit-btn settings-save-btn"
                            onClick={handleGenerateInvite}
                            disabled={inviteGenerating || atInviteLimit}
                            title={atInviteLimit ? 'Maximum 2 invites' : ''}
                        >
                            <i className="bi bi-plus-lg" />
                            {inviteGenerating ? 'Generating…' : 'Generate Invite'}
                        </button>
                    </div>

                    <div className="glass-panel settings-card">
                        <h2 className="settings-section-title">
                            <i className="bi bi-trash3" style={{ color: 'var(--color-primary)' }} /> Delete Account
                        </h2>
                        <p className="settings-profile-since" style={{ margin: 0 }}>
                            This will schedule your account for permanent deletion after a 7-day grace period. All your files, mails, links, and bins will be removed.
                        </p>
                        <button className="settings-delete-btn" onClick={openDeleteModal}>
                            <i className="bi bi-trash3" /> Delete my account
                        </button>
                    </div>

                </div>
            </main>

            {deleteModalOpen && (
                <div className="settings-modal-overlay" onClick={closeDeleteModal}>
                    <div className="settings-modal" onClick={e => e.stopPropagation()}>
                        <div className="settings-modal-icon">
                            <i className="bi bi-exclamation-triangle-fill" />
                        </div>
                        <h2 className="settings-modal-title">Delete Account</h2>
                        <p className="settings-modal-desc">
                            Your account will be <strong>permanently deleted in 7 days</strong>. This includes all your files, mails, links, and bins. This cannot be undone.
                        </p>
                        <form onSubmit={handleDeleteAccount} className="settings-modal-form">
                            <div className="shr-input-wrap">
                                <i className="bi bi-lock shr-input-icon" />
                                <input
                                    className="shr-input"
                                    type="password"
                                    placeholder="Enter your password to confirm"
                                    value={deletePassword}
                                    onChange={e => setDeletePassword(e.target.value)}
                                    disabled={deleteLoading}
                                    required
                                    autoFocus
                                />
                            </div>
                            {deleteError && <p className="settings-error"><i className="bi bi-exclamation-triangle" /> {deleteError}</p>}
                            <div className="settings-modal-actions">
                                <button type="button" className="settings-modal-cancel" onClick={closeDeleteModal} disabled={deleteLoading}>
                                    Cancel
                                </button>
                                <button type="submit" className="settings-modal-confirm" disabled={deleteLoading || !deletePassword}>
                                    <i className="bi bi-trash3" />
                                    {deleteLoading ? 'Deleting…' : 'Delete Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
