import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAvatarSrc } from '../../config/avatars';
import type { MailListItem, MailFolder } from '../../services/MailService';
import { MailPageButtons } from './MailPageButtons';
import { senderColor, senderInitial, parseSender, formatShort } from './mailUtils';

type SortKey = 'newest' | 'oldest' | 'unread' | 'read';
const SORT_LABELS: Record<SortKey, string> = {
    newest: 'Newest first',
    oldest: 'Oldest first',
    unread: 'Unread first',
    read: 'Read first',
};

interface Props {
    mails: MailListItem[];
    loading: boolean;
    folder: MailFolder;
    search: string;
    sort: SortKey;
    page: number;
    totalPages: number;
    checkedIds: Set<string>;
    selectedId: string | null;
    mobileView: 'list' | 'detail';
    mailStorageMb: number;
    blockedSenders: Set<string>;
    user: { username?: string; avatar?: string } | null;
    userEmail: string;
    isAllChecked: boolean;
    anyChecked: boolean;
    onFolderChange: (f: MailFolder) => void;
    onSearchChange: (s: string) => void;
    onSortChange: (s: SortKey) => void;
    onToggleCheck: (id: string, e: React.MouseEvent) => void;
    onToggleAll: () => void;
    onSelect: (mail: MailListItem) => void;
    onChangePage: (p: number) => void;
    onBulkDelete: () => void;
    onBulkReadStatus: (isRead: boolean) => void;
    onBulkMove: (dest: MailFolder) => void;
}

export function MailListPanel({
    mails, loading, folder, search, sort, page, totalPages,
    checkedIds, selectedId, mobileView, mailStorageMb, blockedSenders, user, userEmail,
    isAllChecked, anyChecked,
    onFolderChange, onSearchChange, onSortChange, onToggleCheck, onToggleAll,
    onSelect, onChangePage, onBulkDelete, onBulkReadStatus, onBulkMove,
}: Props) {
    const [sortOpen, setSortOpen] = useState(false);

    const checkedMails = mails.filter(m => checkedIds.has(m.id));
    const canMarkRead   = checkedMails.some(m => !m.isRead);
    const canMarkUnread = checkedMails.some(m => m.isRead);
    const [copiedEmail, setCopiedEmail] = useState(false);
    const [gearRot, setGearRot] = useState(0);
    const sortRef = useRef<HTMLDivElement>(null);

    const copyEmail = () => {
        navigator.clipboard.writeText(userEmail);
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 1500);
    };

    return (
        <div className={`upload-drive-left ${mobileView === 'detail' ? 'mc-hidden-mobile' : ''}`}>
            <div className="bin-tab-row">
                <div className="widget-tab bin-mode-tab bin-tab-active mc-tab-label">
                    <i className={`bi bi-${folder === 'inbox' ? 'inbox' : folder === 'archive' ? 'archive' : 'exclamation-triangle'}`} />
                    {folder.charAt(0).toUpperCase() + folder.slice(1)}
                </div>
            </div>

            <div className="mc-left glass-panel">
                <div className="mc-folder-row">
                    {(['inbox', 'archive', 'spam'] as MailFolder[]).map(f => (
                        <button
                            key={f}
                            className={`mc-folder-btn ${folder === f ? 'mc-folder-btn--active' : ''}`}
                            onClick={() => onFolderChange(f)}
                        >
                            <i className={`bi bi-${f === 'inbox' ? 'inbox' : f === 'archive' ? 'archive' : 'exclamation-triangle'}`} />
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>

                <div className="mc-search-row">
                    <div className="mc-search-wrap">
                        <i className="bi bi-search mc-search-icon" />
                        <input
                            className="mc-search-input"
                            type="text"
                            placeholder="Search…"
                            value={search}
                            onChange={e => onSearchChange(e.target.value)}
                        />
                        {search && (
                            <button className="mc-search-clear" onClick={() => onSearchChange('')}>
                                <i className="bi bi-x-lg" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="mc-toolbar">
                    <label className="mc-checkbox-wrap" title="Select all">
                        <input type="checkbox" className="mc-checkbox" checked={isAllChecked} onChange={onToggleAll} />
                    </label>

                    {anyChecked ? (
                        <div className="mc-toolbar-actions">
                            <span className="mc-selected-label">{checkedIds.size} selected</span>
                            <button className="mc-tool-btn" title="Mark as read" onClick={() => onBulkReadStatus(true)} disabled={!canMarkRead}><i className="bi bi-envelope-open" /></button>
                            <button className="mc-tool-btn" title="Mark as unread" onClick={() => onBulkReadStatus(false)} disabled={!canMarkUnread}><i className="bi bi-envelope" /></button>
                            {folder === 'inbox' && (
                                <button className="mc-tool-btn" title="Archive" onClick={() => onBulkMove('archive')}><i className="bi bi-archive" /></button>
                            )}
                            {folder !== 'spam' ? (
                                <button className="mc-tool-btn" title="Mark as spam" onClick={() => onBulkMove('spam')}><i className="bi bi-exclamation-triangle" /></button>
                            ) : (
                                <button className="mc-tool-btn" title="Not spam" onClick={() => onBulkMove('inbox')}><i className="bi bi-inbox" /></button>
                            )}
                            {folder === 'archive' && (
                                <button className="mc-tool-btn" title="Move to inbox" onClick={() => onBulkMove('inbox')}><i className="bi bi-inbox" /></button>
                            )}
                            <button className="mc-tool-btn danger" title="Delete" onClick={onBulkDelete}><i className="bi bi-trash3" /></button>
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
                                                onClick={() => { onSortChange(k); setSortOpen(false); }}
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

                <div className="mc-list-area">
                    {loading ? (
                        <div className="empty-bins"><i className="bi bi-hourglass-split" /><span>Loading…</span></div>
                    ) : mails.length === 0 ? (
                        <div className="empty-bins"><i className="bi bi-inbox" /><span>{search ? 'No results' : 'Your inbox is empty'}</span></div>
                    ) : mails.map(mail => {
                        const sender = parseSender(mail.from);
                        const isBlockedSender = blockedSenders.has(sender.email);
                        return (
                            <div
                                key={mail.id}
                                className={`mc-mail-row ${selectedId === mail.id ? 'mc-mail-row--active' : ''} ${!mail.isRead ? 'mc-mail-row--unread' : ''} ${isBlockedSender ? 'mc-mail-row--blocked' : ''}`}
                                onClick={() => onSelect(mail)}
                            >
                                <label className="mc-checkbox-wrap" onClick={e => onToggleCheck(mail.id, e)}>
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

                <div className="mc-left-footer">
                    <div className="mc-pagination">
                        <button className="mc-page-btn" onClick={() => onChangePage(page - 1)} disabled={page === 0}>
                            <i className="bi bi-chevron-left" />
                        </button>
                        <div className="mc-page-numbers">
                            <MailPageButtons page={page} total={totalPages} onChange={onChangePage} />
                        </div>
                        <button className="mc-page-btn" onClick={() => onChangePage(page + 1)} disabled={page >= totalPages - 1}>
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
    );
}
