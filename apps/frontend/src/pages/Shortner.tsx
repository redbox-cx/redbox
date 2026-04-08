import { useState, useEffect } from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { MidTruncate } from '../components/MidTruncate';
import { LinkService, type Link } from '../services/LinkService';

const LINK_LIMIT = 25;

function getShortUrl(code: string) {
    return `${window.location.origin}/s/${code}`;
}


export function Shortner() {
    const [links, setLinks] = useState<Link[]>([]);
    const [loading, setLoading] = useState(true);
    const [url, setUrl] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmEntry, setConfirmEntry] = useState<Link | null>(null);

    const loadLinks = async () => {
        try {
            const data = await LinkService.getAll();
            setLinks(data);
        } catch {
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        document.documentElement.classList.add('dash-page');
        return () => { document.documentElement.classList.remove('dash-page'); };
    }, []);

    useEffect(() => { loadLinks(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!url.trim()) return;

        setCreating(true);
        try {
            await LinkService.createLink(url.trim());
            setUrl('');
            await loadLinks();
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setError(Array.isArray(msg) ? msg[0] : msg || 'Failed to shorten URL.');
        } finally {
            setCreating(false);
        }
    };

    const copyLink = (link: Link) => {
        navigator.clipboard.writeText(getShortUrl(link.shortCode));
        setCopiedId(link.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const confirmDelete = async () => {
        if (!confirmEntry) return;
        const entry = confirmEntry;
        setConfirmEntry(null);
        setDeletingId(entry.id);
        try {
            await LinkService.deleteLink(entry.id);
            await loadLinks();
        } catch {
        } finally {
            setDeletingId(null);
        }
    };

    const usedPct = Math.min((links.length / LINK_LIMIT) * 100, 100);

    return (
        <div className="dash-layout">
            {confirmEntry && (
                <div className="confirm-overlay" onClick={() => setConfirmEntry(null)}>
                    <div className="confirm-modal" onClick={e => e.stopPropagation()}>
                        <i className="bi bi-trash3 confirm-modal-icon" />
                        <p className="confirm-modal-title">Delete link?</p>
                        <p className="confirm-modal-desc">"{confirmEntry.originalUrl}" will be permanently deleted.</p>
                        <div className="confirm-modal-actions">
                            <button className="confirm-btn-cancel" onClick={() => setConfirmEntry(null)}>Cancel</button>
                            <button className="confirm-btn-delete" onClick={confirmDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="blob blob-1" />
            <div className="blob blob-2" />
            <TopBar />

            <main className="upload-drive-container">
                <div className="upload-drive-left">
                    <div className="widget-tab"><i className="bi bi-link-45deg" /> Shortner</div>
                    <div className="glass-panel upload-panel">

                        <div className="shr-hero">
                            <i className="bi bi-scissors shr-hero-icon" />
                            <p className="shr-hero-title">Shorten a URL</p>
                            <p className="shr-hero-sub">Paste any link below and get a short shareable URL instantly.</p>
                        </div>

                        <form className="shr-form" onSubmit={handleCreate}>
                            <div className="shr-input-wrap">
                                <i className="bi bi-globe2 shr-input-icon" />
                                <input
                                    className="shr-input"
                                    type="url"
                                    placeholder="https://example.com/very/long/url"
                                    value={url}
                                    onChange={e => setUrl(e.target.value)}
                                    disabled={creating}
                                    required
                                />
                            </div>
                            {error && <p className="upload-error"><i className="bi bi-exclamation-triangle" /> {error}</p>}
                            <button
                                className="upload-submit-btn"
                                type="submit"
                                disabled={creating || links.length >= LINK_LIMIT}
                            >
                                <i className="bi bi-scissors" />
                                {creating ? 'Shortening…' : 'Shorten URL'}
                            </button>
                        </form>

                        <div className="upload-quota">
                            <div className="upload-quota-labels">
                                <span>{links.length} links used</span>
                                <span>{LINK_LIMIT} total</span>
                            </div>
                            <div className="upload-quota-track">
                                <div className="upload-quota-fill" style={{ width: `${usedPct}%` }} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="upload-drive-right">
                    <div className="widget-tab"><i className="bi bi-collection" /> Your Links</div>
                    <div className="glass-panel upload-files-panel">
                        {loading ? (
                            <div className="empty-bins">
                                <i className="bi bi-hourglass-split" />
                                <span>Loading…</span>
                            </div>
                        ) : links.length === 0 ? (
                            <div className="empty-bins">
                                <i className="bi bi-link-45deg" />
                                <span>0 / {LINK_LIMIT} links used</span>
                            </div>
                        ) : (
                            <div className="drive-file-list">
                                {links.map(link => (
                                    <div key={link.id} className="drive-file-row">
                                        <i className="bi bi-link-45deg drive-file-type-icon" />
                                        <div className="drive-file-meta">
                                            <MidTruncate text={link.originalUrl} className="drive-file-name" />
                                            <span className="drive-file-detail shr-short-url">
                                                {getShortUrl(link.shortCode)}
                                            </span>
                                        </div>
                                        <div className="drive-file-actions">
                                            <button
                                                className={`drive-action-btn ${copiedId === link.id ? 'copied' : ''}`}
                                                title="Copy short link"
                                                onClick={() => copyLink(link)}
                                            >
                                                <i className={`bi bi-${copiedId === link.id ? 'check-lg' : 'copy'}`} />
                                            </button>
                                            <button
                                                className="drive-action-btn danger"
                                                title="Delete link"
                                                disabled={deletingId === link.id}
                                                onClick={() => setConfirmEntry(link)}
                                            >
                                                <i className={`bi bi-${deletingId === link.id ? 'hourglass-split' : 'trash3'}`} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
