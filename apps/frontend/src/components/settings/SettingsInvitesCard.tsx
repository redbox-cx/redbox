import { useState, useEffect } from 'react';
import { UserService, type InviteCode } from '../../services/UserService';

export function SettingsInvitesCard() {
    const [invites, setInvites] = useState<InviteCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [revealedCodes, setRevealedCodes] = useState<Set<string>>(new Set());

    useEffect(() => {
        UserService.getInvites().then(setInvites).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const handleGenerate = async () => {
        setError('');
        setGenerating(true);
        try {
            const code = await UserService.generateInvite();
            setInvites(prev => [...prev, code]);
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setError(Array.isArray(msg) ? msg[0] : msg || 'Failed to generate invite.');
        } finally {
            setGenerating(false);
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

    const atLimit = invites.length >= 2;

    return (
        <div className="glass-panel settings-card">
            <h2 className="settings-section-title">
                <i className="bi bi-person-plus-fill" /> Invite Codes
            </h2>
            {loading ? (
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
                                        onClick={e => copyCode(inv.code, e)}
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
            {error && <p className="settings-error"><i className="bi bi-exclamation-triangle" /> {error}</p>}
            <button
                className="upload-submit-btn settings-save-btn"
                onClick={handleGenerate}
                disabled={generating || atLimit}
                title={atLimit ? 'Maximum 2 invites' : ''}
            >
                <i className="bi bi-plus-lg" />
                {generating ? 'Generating…' : 'Generate Invite'}
            </button>
        </div>
    );
}
