import { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { TopBar } from '../components/dashboard/TopBar';
import { MidTruncate } from '../components/MidTruncate';
import { BinService, type BinEntry } from '../services/BinService';
import { BinCrypto } from '../services/BinCrypto';

const BIN_LIMIT = 100;

const EXPIRY_OPTIONS = [
    { label: '1 hour',   value: '1h' },
    { label: '24 hours', value: '24h' },
    { label: '7 days',   value: '7d' },
    { label: '30 days',  value: '30d' },
    { label: 'Never',    value: 'never' },
];

type PreviewMode = 'plain' | 'code' | 'markdown';

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024, s = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
}

function formatDate(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}


function ExpiryDropdown({ value, onChange, disabled }: {
    value: string; onChange: (v: string) => void; disabled: boolean;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const selected = EXPIRY_OPTIONS.find(o => o.value === value) ?? EXPIRY_OPTIONS[3];

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className="bin-dropdown" ref={ref}>
            <button type="button" className="bin-dropdown-btn" onClick={() => !disabled && setOpen(v => !v)} disabled={disabled}>
                <i className="bi bi-clock" />
                <span>{selected.label}</span>
                <i className={`bi bi-chevron-${open ? 'up' : 'down'} bin-dropdown-chevron`} />
            </button>
            {open && (
                <div className="bin-dropdown-menu">
                    {EXPIRY_OPTIONS.map(o => (
                        <button key={o.value} type="button"
                            className={`bin-dropdown-item ${o.value === value ? 'active' : ''}`}
                            onClick={() => { onChange(o.value); setOpen(false); }}
                        >
                            {o.label}
                            {o.value === value && <i className="bi bi-check-lg" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export function Bin() {
    const [bins, setBins] = useState<BinEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const [isPreview, setIsPreview] = useState(false);
    const [previewMode, setPreviewMode] = useState<PreviewMode>('plain');

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [expiresIn, setExpiresIn] = useState('30d');

    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmEntry, setConfirmEntry] = useState<BinEntry | null>(null);

    useEffect(() => {
        document.documentElement.classList.add('dash-page');
        return () => { document.documentElement.classList.remove('dash-page'); };
    }, []);

    const loadBins = async () => {
        try { setBins(await BinService.getAll()); }
        catch { /* ignorar */ }
        finally { setLoading(false); }
    };

    useEffect(() => { loadBins(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!content.trim()) return;
        setCreating(true);
        try {
            const { cryptoKey, keyHex } = await BinCrypto.generateBinKey();
            const encryptedContent = await BinCrypto.encryptText(cryptoKey, content);
            const size = new TextEncoder().encode(content).byteLength;

            await BinService.create({
                content: encryptedContent,
                size,
                title: title.trim() || undefined,
                password: password || undefined,
                expiresIn,
                binKey: keyHex,
            });


            setTitle(''); setContent(''); setPassword('');
            setShowPassword(false); setExpiresIn('30d'); setIsPreview(false);
            await loadBins();
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setError(Array.isArray(msg) ? msg[0] : msg || 'Failed to create bin.');
        } finally {
            setCreating(false);
        }
    };

    const copyLink = async (bin: BinEntry) => {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}${bin.shareLink}`);
            setCopiedId(bin.id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch { setError('Failed to copy link.'); }
    };

    const openBin = (bin: BinEntry) => {
        window.open(`${window.location.origin}${bin.shareLink}`, '_blank');
    };

    const confirmDelete = async () => {
        if (!confirmEntry) return;
        const entry = confirmEntry;
        setConfirmEntry(null);
        setDeletingId(entry.id);
        try { await BinService.deleteBin(entry.id); await loadBins(); }
        catch { /* ignorar */ }
        finally { setDeletingId(null); }
    };

    const markdownHtml = isPreview && previewMode === 'markdown'
        ? marked.parse(content, { async: false }) as string : '';

    const usedPct = Math.min((bins.length / BIN_LIMIT) * 100, 100);

    const PREVIEW_LABELS: Record<PreviewMode, string> = {
        plain: 'Plain text',
        code: 'Source code',
        markdown: 'Markdown',
    };

    return (
        <div className="dash-layout">
            {confirmEntry && (
                <div className="confirm-overlay" onClick={() => setConfirmEntry(null)}>
                    <div className="confirm-modal" onClick={e => e.stopPropagation()}>
                        <i className="bi bi-trash3 confirm-modal-icon" />
                        <p className="confirm-modal-title">Delete bin?</p>
                        <p className="confirm-modal-desc">"{confirmEntry.title || 'Untitled Bin'}" will be permanently deleted.</p>
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

            <main className="upload-drive-container bin-drive-container">
                <div className="upload-drive-left">
                    <div className="bin-tab-row">
                        <button
                            type="button"
                            className={`widget-tab bin-mode-tab ${!isPreview ? 'bin-tab-active' : ''}`}
                            onClick={() => setIsPreview(false)}
                        >
                            <i className="bi bi-pencil" /> Write
                        </button>
                        <button
                            type="button"
                            className={`widget-tab bin-mode-tab ${isPreview ? 'bin-tab-active' : ''}`}
                            onClick={() => setIsPreview(true)}
                        >
                            <i className="bi bi-eye" /> Preview
                        </button>
                    </div>

                    <div className="glass-panel upload-panel bin-create-panel">
                        {!isPreview ? (
                            <form className="bin-form" onSubmit={handleCreate}>
                                <input
                                    className="bin-title-input"
                                    type="text"
                                    placeholder="Title (optional)"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    disabled={creating}
                                    maxLength={100}
                                />
                                <textarea
                                    className="bin-textarea"
                                    placeholder="Paste or type your text here…"
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    disabled={creating}
                                    maxLength={2000000}
                                    required
                                />
                                <span className="bin-char-count">{content.length.toLocaleString()} / 2,000,000</span>

                                <div className="bin-options-row">
                                    <ExpiryDropdown value={expiresIn} onChange={setExpiresIn} disabled={creating} />
                                    <button
                                        type="button"
                                        className={`upload-password-toggle ${showPassword ? 'active' : ''}`}
                                        onClick={() => setShowPassword(v => !v)}
                                        disabled={creating}
                                    >
                                        <i className={`bi bi-lock${showPassword ? '-fill' : ''}`} />
                                        {showPassword ? 'Password on' : 'Add password'}
                                    </button>
                                </div>

                                {showPassword && (
                                    <div className="shr-input-wrap">
                                        <i className="bi bi-shield-lock shr-input-icon" />
                                        <input
                                            className="shr-input"
                                            type="password"
                                            placeholder="Password…"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            disabled={creating}
                                            maxLength={100}
                                        />
                                    </div>
                                )}

                                {error && <p className="upload-error"><i className="bi bi-exclamation-triangle" /> {error}</p>}

                                <button
                                    className="upload-submit-btn"
                                    type="submit"
                                    disabled={creating || !content.trim() || bins.length >= BIN_LIMIT}
                                >
                                    <i className="bi bi-shield-lock" />
                                    {creating ? 'Encrypting…' : 'Encrypt & Save'}
                                </button>
                            </form>
                        ) : (
                            <div className="bin-preview-area">
                                <div className="bin-format-bar">
                                    {(Object.keys(PREVIEW_LABELS) as PreviewMode[]).map(m => (
                                        <button key={m} type="button"
                                            className={`bin-format-btn ${previewMode === m ? 'active' : ''}`}
                                            onClick={() => setPreviewMode(m)}
                                        >
                                            {PREVIEW_LABELS[m]}
                                        </button>
                                    ))}
                                </div>
                                {content ? (
                                    previewMode === 'markdown' ? (
                                        <div className="bin-preview-markdown"
                                            dangerouslySetInnerHTML={{ __html: markdownHtml }} />
                                    ) : previewMode === 'code' ? (
                                        <pre className="bin-preview-code"><code>{content}</code></pre>
                                    ) : (
                                        <pre className="bin-preview-plain">{content}</pre>
                                    )
                                ) : (
                                    <div className="bin-preview-empty">
                                        <i className="bi bi-eye-slash" />
                                        <span>Nothing to preview yet. Switch to Write and add some text.</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="upload-quota">
                            <div className="upload-quota-labels">
                                <span>{bins.length} bins used</span>
                                <span>{BIN_LIMIT} total</span>
                            </div>
                            <div className="upload-quota-track">
                                <div className="upload-quota-fill" style={{ width: `${usedPct}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="upload-drive-right">
                    <div className="widget-tab"><i className="bi bi-collection" /> Your Bins</div>
                    <div className="glass-panel upload-files-panel">
                        {loading ? (
                            <div className="empty-bins"><i className="bi bi-hourglass-split" /><span>Loading…</span></div>
                        ) : bins.length === 0 ? (
                            <div className="empty-bins"><i className="bi bi-file-text" /><span>0 / {BIN_LIMIT} bins used</span></div>
                        ) : (
                            <div className="drive-file-list">
                                {bins.map(bin => (
                                    <div key={bin.id} className="drive-file-row">
                                        <i className="bi bi-file-text drive-file-type-icon" />
                                        <div className="drive-file-meta">
                                            <MidTruncate text={bin.title || 'Untitled Bin'} className="drive-file-name" />
                                            <span className="drive-file-detail">
                                                {formatBytes(bin.size)} · Expires {formatDate(bin.expiresAt)}
                                            </span>
                                        </div>
                                        <div className="drive-file-actions">
                                            <button className="drive-action-btn" title="Open bin" onClick={() => openBin(bin)}>
                                                <i className="bi bi-box-arrow-up-right" />
                                            </button>
                                            <button
                                                className={`drive-action-btn ${copiedId === bin.id ? 'copied' : ''}`}
                                                title="Copy share link" onClick={() => copyLink(bin)}
                                            >
                                                <i className={`bi bi-${copiedId === bin.id ? 'check-lg' : 'link-45deg'}`} />
                                            </button>
                                            <button
                                                className="drive-action-btn danger" title="Delete bin"
                                                disabled={deletingId === bin.id} onClick={() => setConfirmEntry(bin)}
                                            >
                                                <i className={`bi bi-${deletingId === bin.id ? 'hourglass-split' : 'trash3'}`} />
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
