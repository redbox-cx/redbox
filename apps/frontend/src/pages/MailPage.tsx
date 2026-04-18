import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TopBar } from '../components/dashboard/TopBar';
import { useAuth } from '../context/AuthContext';
import { MailService, type MailListItem, type MailDetail, type MailFolder } from '../services/MailService';
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

    if (total <= 3) {
        for (let i = 0; i < total; i++) items.push(i);
    } else if (page === 0) {
        items.push(0, 1, '…', total - 1);
    } else if (page === total - 1) {
        items.push(0, '…', total - 2, total - 1);
    } else {
        items.push(0);
        if (page > 1) items.push('…');
        items.push(page);
        if (page < total - 2) items.push('…');
        items.push(total - 1);
    }

    return (
        <>
            {items.map((p, i) =>
                p === '…'
                    ? <span key={`e${i}`} className="mc-page-ellipsis">…</span>
                    : <button key={p} className={`mc-page-btn ${page === p ? 'mc-page-btn--active' : ''}`} onClick={() => onChange(p as number)}>{(p as number) + 1}</button>
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

    const loadPage = async (p: number, s = sort, f = folder) => {
        setLoading(true);
        try {
            const res = await MailService.getAll(PAGE_SIZE, p * PAGE_SIZE, s, f);
            if (res.mails.length > 0) {
                setMails(res.mails);
                setTotalCount(res.totalCount);
            }
        } catch { /* keep dummy data */ }
        finally { setLoading(false); }
    };

    useEffect(() => { loadPage(page, sort, folder); }, [page, sort, folder]);

    useEffect(() => {
        MailService.getStorage()
            .then(s => setMailStorageMb(s.usedMb))
            .catch(() => {});
    }, []);

    const displayed = useMemo(() => {
        let list = mails;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(m =>
                m.from.toLowerCase().includes(q) ||
                (m.subject ?? '').toLowerCase().includes(q)
            );
        }
        return [...list].sort((a, b) => {
            if (sort === 'oldest') return +new Date(a.createdAt) - +new Date(b.createdAt);
            if (sort === 'unread') return (a.isRead ? 1 : 0) - (b.isRead ? 1 : 0);
            if (sort === 'read') return (a.isRead ? 0 : 1) - (b.isRead ? 0 : 1);
            return +new Date(b.createdAt) - +new Date(a.createdAt);
        });
    }, [mails, search, sort]);

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
            if (!mail.isRead) setMails(prev => prev.map(m => m.id === mail.id ? { ...m, isRead: true } : m));
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
