import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TopBar } from '../components/dashboard/TopBar';
import { useAuth } from '../context/AuthContext';
import { MailService, type MailListItem, type MailDetail, type MailFolder, type MailAttachment } from '../services/MailService';
import { getAvatarSrc } from '../config/avatars';

const PAGE_SIZE = 50;

function senderColor(_str: string): string {
    return 'var(--color-primary)';
}

function senderInitial(from: string): string {
    const name = from.match(/^(.+?)\s*</)?.[1]?.trim().replace(/^"|"$/g, '') ?? from;
    return (name[0] ?? '?').toUpperCase();
}

function parseSender(from: string): { name: string; email: string } {
    const match = from.match(/^(.+?)\s*<(.+?)>$/);
    if (match) return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim() };
    return { name: from, email: from };
}

function formatShort(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString())
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (d.getFullYear() === now.getFullYear())
        return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatFull(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentIcon(mimetype: string): string {
    if (mimetype.startsWith('image/')) return 'bi-file-earmark-image';
    if (mimetype === 'application/pdf') return 'bi-file-earmark-pdf';
    if (mimetype.includes('zip') || mimetype.includes('compressed')) return 'bi-file-earmark-zip';
    if (mimetype.startsWith('text/')) return 'bi-file-earmark-text';
    if (mimetype.includes('word') || mimetype.includes('document')) return 'bi-file-earmark-word';
    if (mimetype.includes('sheet') || mimetype.includes('excel')) return 'bi-file-earmark-excel';
    return 'bi-file-earmark';
}

type SortKey = 'newest' | 'oldest' | 'unread' | 'read';
const SORT_LABELS: Record<SortKey, string> = {
    'newest': 'Newest first',
    'oldest': 'Oldest first',
    'unread': 'Unread first',
    'read': 'Read first',
};

function PageButtons({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
    if (total <= 1) return null;

    const items: (number | '…')[] = [];

    if (total <= 7) {
        for (let i = 0; i < total; i++) items.push(i);
    } else {
        items.push(0);
        if (page > 2) items.push('…');
        const start = Math.max(1, page - 1);
        const end = Math.min(total - 2, page + 1);
        for (let i = start; i <= end; i++) items.push(i);
        if (page < total - 3) items.push('…');
        items.push(total - 1);
    }

    return (
        <>
            {items.map((item, i) =>
                item === '…'
                    ? <span key={`e${i}`} className="mc-page-ellipsis">…</span>
                    : <button key={item} className={`mc-page-btn ${page === item ? 'mc-page-btn--active' : ''}`} onClick={() => onChange(item as number)}>{(item as number) + 1}</button>
            )}
        </>
    );
}


export function MailPage() {
    const { user } = useAuth();
    const [mails, setMails] = useState<MailListItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortKey>('newest');
    const [folder, setFolder] = useState<MailFolder>('inbox');
    const [sortOpen, setSortOpen] = useState(false);
    const [selected, setSelected] = useState<MailDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
    const [copiedEmail, setCopiedEmail] = useState(false);
    const [gearRot, setGearRot] = useState(0);
    const [mailStorageMb, setMailStorageMb] = useState(0);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const sortRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        document.documentElement.classList.add('dash-page', 'mail-page');
        return () => { document.documentElement.classList.remove('dash-page', 'mail-page'); };
    }, []);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(0);
        }, 350);
        return () => clearTimeout(t);
    }, [search]);

    const loadPage = async (p: number, s: SortKey, f: MailFolder, q: string) => {
        setLoading(true);
        try {
            const res = await MailService.getAll(PAGE_SIZE, p * PAGE_SIZE, s, f, q);
            setMails(res.mails);
            setTotalCount(res.totalCount);
        } catch {}
        finally { setLoading(false); }
    };

    useEffect(() => { setMails([]); loadPage(page, sort, folder, debouncedSearch); }, [page, sort, folder, debouncedSearch]);

    useEffect(() => {
        MailService.getStorage()
            .then(s => setMailStorageMb(s.usedMb))
            .catch(() => {});
    }, []);

    const displayed = useMemo(() => {
        return [...mails].sort((a, b) => {
            if (sort === 'oldest') return +new Date(a.createdAt) - +new Date(b.createdAt);
            if (sort === 'unread') return (a.isRead ? 1 : 0) - (b.isRead ? 1 : 0);
            if (sort === 'read') return (a.isRead ? 0 : 1) - (b.isRead ? 0 : 1);
            return +new Date(b.createdAt) - +new Date(a.createdAt);
        });
    }, [mails, sort]);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const userEmail = (mails[0]?.to ?? '__user__@redbox.cx').replace('__user__', user?.username ?? 'user');

    const isAllChecked = displayed.length > 0 && displayed.every(m => checkedIds.has(m.id));
    const anyChecked = checkedIds.size > 0;

    const toggleCheck = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCheckedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (isAllChecked) setCheckedIds(new Set());
        else setCheckedIds(new Set(displayed.map(m => m.id)));
    };

    const handleSelect = async (mail: MailListItem) => {
        if (selected?.id === mail.id) return;
        setLoadingDetail(true);
        setMobileView('detail');
        try {
            const detail = await MailService.getById(mail.id);
            setSelected(detail);
            if (!mail.isRead) {
                setMails(prev => prev.map(m => m.id === mail.id ? { ...m, isRead: true } : m));
                MailService.setReadStatus(mail.id, true).catch(() => {});
            }
        } catch {}
        finally { setLoadingDetail(false); }
    };

    const handleIframeLoad = () => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        try {
            const body = iframe.contentDocument?.body;
            if (body) iframe.style.height = `${body.scrollHeight + 32}px`;
        } catch {}
    };

    const copyEmail = () => {
        navigator.clipboard.writeText(userEmail);
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 1500);
    };

    const changePage = (p: number) => {
        setPage(p);
        setSelected(null);
        setCheckedIds(new Set());
    };

    const handleDelete = async (id: string) => {
        try {
            await MailService.deleteMail(id);
            setMails(prev => prev.filter(m => m.id !== id));
            setTotalCount((prev: number) => prev - 1);
            if (selected?.id === id) setSelected(null);
        } catch {}
    };

    const handleReadStatus = async (id: string, isRead: boolean) => {
        try {
            await MailService.setReadStatus(id, isRead);
            setMails(prev => prev.map(m => m.id === id ? { ...m, isRead } : m));
            if (selected?.id === id) setSelected(prev => prev ? { ...prev, isRead } : null);
        } catch {}
    };

    const handleMove = async (id: string, dest: MailFolder) => {
        try {
            await MailService.moveMail(id, dest);
            setMails(prev => prev.filter(m => m.id !== id));
            setTotalCount((prev: number) => prev - 1);
            if (selected?.id === id) setSelected(null);
        } catch {}
    };

    const handleBlockSender = async (email: string) => {
        try { await MailService.blockSender(email); } catch {}
    };

    const handleBulkDelete = async () => {
        const ids = [...checkedIds];
        try {
            await MailService.bulkDelete(ids);
            setMails(prev => prev.filter(m => !checkedIds.has(m.id)));
            setTotalCount((prev: number) => prev - ids.length);
            setCheckedIds(new Set());
            if (selected && checkedIds.has(selected.id)) setSelected(null);
        } catch {}
    };

    const handleBulkReadStatus = async (isRead: boolean) => {
        const ids = [...checkedIds];
        try {
            await MailService.bulkSetReadStatus(ids, isRead);
            setMails(prev => prev.map(m => checkedIds.has(m.id) ? { ...m, isRead } : m));
            setCheckedIds(new Set());
        } catch {}
    };

    const handleDownloadAttachment = async (attachment: MailAttachment) => {
        if (!selected || downloadingId === attachment.id) return;
        setDownloadingId(attachment.id);
        try {
            await MailService.downloadAttachment(selected.id, attachment.id, attachment.filename);
        } catch {}
        finally { setDownloadingId(null); }
    };

    const handleBulkMove = async (dest: MailFolder) => {
        const ids = [...checkedIds];
        try {
            await MailService.bulkMove(ids, dest);
            setMails(prev => prev.filter(m => !checkedIds.has(m.id)));
            setTotalCount((prev: number) => prev - ids.length);
            setCheckedIds(new Set());
            if (selected && checkedIds.has(selected.id)) setSelected(null);
        } catch {}
    };

    return (
        <div className="dash-layout">
            <div className="blob blob-1" />
            <div className="blob blob-2" />
            <TopBar />

            <main className="upload-drive-container mc-app">

                {/* ══ LEFT COLUMN ══ */}
                <div className={`upload-drive-left ${mobileView === 'detail' ? 'mc-hidden-mobile' : ''}`}>
                    <div className="bin-tab-row">
                        <div className="widget-tab bin-mode-tab bin-tab-active mc-tab-label">
                            <i className={`bi bi-${folder === 'inbox' ? 'inbox' : folder === 'archive' ? 'archive' : 'exclamation-triangle'}`} />
                            {folder.charAt(0).toUpperCase() + folder.slice(1)}
                        </div>
                    </div>

                    <div className="mc-left glass-panel">

                        {/* Folder switcher */}
                        <div className="mc-folder-row">
                            {(['inbox', 'archive', 'spam'] as MailFolder[]).map(f => (
                                <button
                                    key={f}
                                    className={`mc-folder-btn ${folder === f ? 'mc-folder-btn--active' : ''}`}
                                    onClick={() => { setFolder(f); setPage(0); setSelected(null); setCheckedIds(new Set()); }}
                                >
                                    <i className={`bi bi-${f === 'inbox' ? 'inbox' : f === 'archive' ? 'archive' : 'exclamation-triangle'}`} />
                                    {f.charAt(0).toUpperCase() + f.slice(1)}
                                </button>
                            ))}
                        </div>

                        {/* Search */}
                        <div className="mc-search-row">
                            <div className="mc-search-wrap">
                                <i className="bi bi-search mc-search-icon" />
                                <input
                                    className="mc-search-input"
                                    type="text"
                                    placeholder="Search…"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                                {search && (
                                    <button className="mc-search-clear" onClick={() => setSearch('')}>
                                        <i className="bi bi-x-lg" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Toolbar */}
                        <div className="mc-toolbar">
                            <label className="mc-checkbox-wrap" title="Select all">
                                <input type="checkbox" className="mc-checkbox" checked={isAllChecked} onChange={toggleAll} />
                            </label>

                            {anyChecked ? (
                                <div className="mc-toolbar-actions">
                                    <span className="mc-selected-label">{checkedIds.size} selected</span>
                                    <button className="mc-tool-btn" title="Mark as read" onClick={() => handleBulkReadStatus(true)}><i className="bi bi-envelope-open" /></button>
                                    <button className="mc-tool-btn" title="Mark as unread" onClick={() => handleBulkReadStatus(false)}><i className="bi bi-envelope" /></button>
                                    <button className="mc-tool-btn" title="Archive" onClick={() => handleBulkMove('archive')}><i className="bi bi-archive" /></button>
                                    <button className="mc-tool-btn danger" title="Delete" onClick={handleBulkDelete}><i className="bi bi-trash3" /></button>
                                </div>
                            ) : (
                                <div className="mc-toolbar-actions">
                                    <button className="mc-tool-btn" title="Archive" disabled><i className="bi bi-archive" /></button>
                                    <button className="mc-tool-btn danger" title="Delete" disabled><i className="bi bi-trash3" /></button>
                                    <div className="mc-sort-wrap" ref={sortRef}>
                                        <button className="mc-tool-btn" title="Sort" onClick={() => setSortOpen(v => !v)}>
                                            <i className="bi bi-sort-down" />
                                        </button>
                                        {sortOpen && (
                                            <div className="mc-sort-menu">
                                                {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                                                    <button key={k}
                                                        className={`mc-sort-item ${sort === k ? 'active' : ''}`}
                                                        onClick={() => { setSort(k); setSortOpen(false); }}
                                                    >
                                                        {SORT_LABELS[k]}
                                                        {sort === k && <i className="bi bi-check-lg" />}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Mail list */}
                        <div className="mc-list-area">
                            {loading ? (
                                <div className="empty-bins"><i className="bi bi-hourglass-split" /><span>Loading…</span></div>
                            ) : displayed.length === 0 ? (
                                <div className="empty-bins"><i className="bi bi-inbox" /><span>{search ? 'No results' : 'Your inbox is empty'}</span></div>
                            ) : displayed.map(mail => {
                                const sender = parseSender(mail.from);
                                return (
                                    <div
                                        key={mail.id}
                                        className={`mc-mail-row ${selected?.id === mail.id ? 'mc-mail-row--active' : ''} ${!mail.isRead ? 'mc-mail-row--unread' : ''}`}
                                        onClick={() => handleSelect(mail)}
                                    >
                                        <label className="mc-checkbox-wrap" onClick={e => toggleCheck(mail.id, e)}>
                                            <input type="checkbox" className="mc-checkbox" checked={checkedIds.has(mail.id)} onChange={() => {}} />
                                        </label>
                                        <div className="mc-sender-avatar" style={{ background: senderColor(mail.from) }}>
                                            {senderInitial(mail.from)}
                                        </div>
                                        <div className="mc-row-body">
                                            <div className="mc-row-top">
                                                <span className="mc-row-from">
                                                    {sender.name !== sender.email ? sender.name : sender.email}
                                                </span>
                                                <span className="mc-row-date">{formatShort(mail.createdAt)}</span>
                                            </div>
                                            <span className={`mc-row-subject ${!mail.isRead ? 'mc-row-subject--bold' : ''}`}>
                                                {mail.subject || '(No subject)'}
                                                {mail.hasAttachments && <i className="bi bi-paperclip mc-row-attach" />}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="mc-left-footer">
                            <div className="mc-pagination">
                                <button className="mc-page-btn" onClick={() => changePage(page - 1)} disabled={page === 0}>
                                    <i className="bi bi-chevron-left" />
                                </button>
                                <div className="mc-page-numbers">
                                    <PageButtons page={page} total={totalPages} onChange={changePage} />
                                </div>
                                <button className="mc-page-btn" onClick={() => changePage(page + 1)} disabled={page >= totalPages - 1}>
                                    <i className="bi bi-chevron-right" />
                                </button>
                            </div>

                            <div className="upload-quota">
                                <div className="upload-quota-labels">
                                    <span>{mailStorageMb} MB used</span>
                                    <span>500 MB</span>
                                </div>
                                <div className="upload-quota-track">
                                    <div className="upload-quota-fill" style={{ width: `${Math.min((mailStorageMb / 500) * 100, 100)}%` }} />
                                </div>
                            </div>

                            <div className="mc-user-row">
                                <div className="mc-user-pill">
                                    <div className="mc-user-avatar">
                                        {user?.avatar
                                            ? <img src={getAvatarSrc(user.avatar)} alt="avatar" />
                                            : <i className="bi bi-person-fill" />}
                                    </div>
                                    <div className="mc-user-info">
                                        <span className="mc-user-name">{user?.username}</span>
                                        <button className="mc-user-email-btn" onClick={copyEmail} title="Copy address">
                                            <span>{userEmail}</span>
                                            <i className={`bi bi-${copiedEmail ? 'check-lg' : 'copy'}`} />
                                        </button>
                                    </div>
                                </div>
                                <Link to="/user/settings" className="mc-config-btn" title="Settings"
                                    onMouseEnter={() => setGearRot(r => r + 180)}>
                                    <i className="bi bi-gear" style={{ transform: `rotate(${gearRot}deg)`, transition: 'transform 0.8s ease', display: 'inline-flex' }} />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
                <div className={`upload-drive-right ${mobileView === 'list' ? 'mc-hidden-mobile' : ''}`}>
                    <div className="bin-tab-row">
                        <div className="widget-tab bin-mode-tab bin-tab-active mc-tab-label">
                            <i className="bi bi-envelope-open" /> View
                        </div>
                    </div>

                    <div className="mc-right glass-panel">
                        {/* ── Action toolbar (always visible) ── */}
                        <div className="mc-view-toolbar">
                            <button className="mc-view-back-btn" disabled={!selected}
                                onClick={() => { setSelected(null); setMobileView('list'); }}>
                                <i className="bi bi-arrow-left" />
                            </button>
                            <div className="mc-view-pill">
                                <button className="mc-view-btn" disabled={!selected}
                                    onClick={() => selected && handleReadStatus(selected.id, !selected.isRead)}>
                                    <i className={`bi bi-envelope${selected?.isRead ? '' : '-open'}`} />
                                    <span className="mc-view-tooltip">{selected?.isRead ? 'Mark unread' : 'Mark read'}</span>
                                </button>
                                <button className="mc-view-btn" disabled={!selected}
                                    onClick={() => selected && handleMove(selected.id, 'archive')}>
                                    <i className="bi bi-archive" />
                                    <span className="mc-view-tooltip">Archive</span>
                                </button>
                                <button className="mc-view-btn" disabled={!selected}
                                    onClick={() => { if (selected) { const s = parseSender(selected.from); handleBlockSender(s.email); } }}>
                                    <i className="bi bi-slash-circle" />
                                    <span className="mc-view-tooltip">Block sender</span>
                                </button>
                                <button className="mc-view-btn danger" disabled={!selected}
                                    onClick={() => selected && handleDelete(selected.id)}>
                                    <i className="bi bi-trash3" />
                                    <span className="mc-view-tooltip">Delete</span>
                                </button>
                            </div>
                        </div>

                        {loadingDetail ? (
                            <div className="empty-bins"><i className="bi bi-hourglass-split" /><span>Loading…</span></div>
                        ) : selected ? (
                            <div className="mc-detail-content">
                                <div className="mc-detail-header">
                                    {/* Subject */}
                                    <h2 className="mc-detail-subject">{selected.subject || '(No subject)'}</h2>

                                    {/* Sender row */}
                                    <div className="mc-detail-sender-row">
                                        <div className="mc-detail-avatar" style={{ background: senderColor(selected.from) }}>
                                            {senderInitial(selected.from)}
                                        </div>
                                        <div className="mc-detail-sender-info">
                                            {(() => {
                                                const s = parseSender(selected.from);
                                                return (
                                                    <>
                                                        {s.name !== s.email && <span className="mc-detail-sender-name">{s.name}</span>}
                                                        <span className="mc-detail-sender-email">{s.email}</span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                        <span className="mc-detail-ts">{formatFull(selected.createdAt)}</span>
                                    </div>
                                </div>

                                {selected.attachments?.length > 0 && (
                                    <div className="mc-attachments">
                                        <p className="mc-attachments-label">
                                            <i className="bi bi-paperclip" /> {selected.attachments.length} attachment{selected.attachments.length !== 1 ? 's' : ''}
                                        </p>
                                        <div className="mc-attachments-list">
                                            {selected.attachments.map(att => (
                                                <button
                                                    key={att.id}
                                                    className={`mc-attachment-item ${downloadingId === att.id ? 'mc-attachment-item--loading' : ''}`}
                                                    onClick={() => handleDownloadAttachment(att)}
                                                    disabled={downloadingId === att.id}
                                                    title={att.filename}
                                                >
                                                    <i className={`bi ${attachmentIcon(att.mimetype)} mc-attachment-icon`} />
                                                    <span className="mc-attachment-name">{att.filename}</span>
                                                    <span className="mc-attachment-size">{formatBytes(att.size)}</span>
                                                    <i className={`bi bi-${downloadingId === att.id ? 'hourglass-split' : 'download'} mc-attachment-dl`} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="mc-iframe-wrap">
                                    <iframe
                                        ref={iframeRef}
                                        className="mc-iframe"
                                        srcDoc={`<style>body{font-family:'Montserrat',sans-serif;margin:0;padding:0;}</style>${selected.content}`}
                                        sandbox="allow-same-origin"
                                        onLoad={handleIframeLoad}
                                        title="Mail content"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="empty-bins">
                                <i className="bi bi-envelope-open" />
                                <span>Select a message to read</span>
                            </div>
                        )}
                    </div>
                </div>

            </main>
        </div>
    );
}
