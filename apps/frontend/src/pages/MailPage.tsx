import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { TopBar } from '../components/dashboard/TopBar';
import { useAuth } from '../context/AuthContext';
import { MailService, type MailListItem, type MailDetail, type MailFolder, type MailAttachment } from '../services/MailService';
import { MailListPanel } from '../components/mail/MailListPanel';
import { MailDetailPanel } from '../components/mail/MailDetailPanel';
import { MailDeleteModal } from '../components/mail/MailDeleteModal';
import { useMailEvents } from '../hooks/useMailEvents';

const PAGE_SIZE = 50;
type SortKey = 'newest' | 'oldest' | 'unread' | 'read';
type DeleteRequest = {
    ids: string[];
    subject?: string | null;
};

export function MailPage() {
    const { user } = useAuth();
    const location = useLocation();

    const [mails, setMails] = useState<MailListItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortKey>('newest');
    const [folder, setFolder] = useState<MailFolder>('inbox');
    const [selected, setSelected] = useState<MailDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
    const [mailStorageMb, setMailStorageMb] = useState(0);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [blockedSenders, setBlockedSenders] = useState<Set<string>>(new Set());
    const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        document.documentElement.classList.add('dash-page', 'mail-page');
        return () => { document.documentElement.classList.remove('dash-page', 'mail-page'); };
    }, []);

    useEffect(() => {
        const t = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 350);
        return () => clearTimeout(t);
    }, [search]);

    const loadPage = async (p: number, s: SortKey, f: MailFolder, q: string) => {
        setLoading(true);
        try {
            const res = await MailService.getAll(PAGE_SIZE, p * PAGE_SIZE, s, f, q);
            setMails(res.mails);
            setTotalCount(res.totalCount);
            setMailStorageMb(Math.round(res.totalUsed / (1024 * 1024)));
        } catch {}
        finally { setLoading(false); }
    };

    useEffect(() => { setMails([]); loadPage(page, sort, folder, debouncedSearch); }, [page, sort, folder, debouncedSearch]);

    useMailEvents(() => loadPage(page, sort, folder, debouncedSearch));

    useEffect(() => {
        MailService.getBlockedSenders().then(list => setBlockedSenders(new Set(list))).catch(() => {});
    }, []);

    useEffect(() => {
        const openMailId = (location.state as any)?.openMailId;
        if (!openMailId) return;
        setLoadingDetail(true);
        setMobileView('detail');
        MailService.getById(openMailId).then(detail => {
            setSelected(detail);
            setMails(prev => prev.map(m => m.id === openMailId ? { ...m, isRead: true } : m));
            MailService.setReadStatus(openMailId, true).catch(() => {});
        }).catch(() => {}).finally(() => setLoadingDetail(false));
    }, [location.state]);

    const displayed = useMemo(() => [...mails].sort((a, b) => {
        if (sort === 'oldest') return +new Date(a.createdAt) - +new Date(b.createdAt);
        if (sort === 'unread') return (a.isRead ? 1 : 0) - (b.isRead ? 1 : 0);
        if (sort === 'read') return (a.isRead ? 0 : 1) - (b.isRead ? 0 : 1);
        return +new Date(b.createdAt) - +new Date(a.createdAt);
    }), [mails, sort]);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const userEmail = `${user?.username ?? 'user'}@redbox.cx`;
    const isAllChecked = displayed.length > 0 && displayed.every(m => checkedIds.has(m.id));
    const anyChecked = checkedIds.size > 0;

    const toggleCheck = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCheckedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
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

    const changePage = (p: number) => { setPage(p); setSelected(null); setCheckedIds(new Set()); };

    const handleFolderChange = (f: MailFolder) => { setFolder(f); setPage(0); setSelected(null); setCheckedIds(new Set()); };

    const requestDelete = (id: string) => {
        const mail = selected?.id === id ? selected : mails.find(m => m.id === id);
        setDeleteRequest({ ids: [id], subject: mail?.subject });
    };

    const confirmDelete = async () => {
        if (!deleteRequest || deleting) return;

        const ids = deleteRequest.ids;
        const idSet = new Set(ids);
        setDeleting(true);
        try {
            if (ids.length === 1) {
                await MailService.deleteMail(ids[0]);
            } else {
                await MailService.bulkDelete(ids);
            }

            setMails(prev => prev.filter(m => !idSet.has(m.id)));
            setTotalCount(prev => Math.max(0, prev - ids.length));
            setCheckedIds(prev => {
                const next = new Set(prev);
                ids.forEach(id => next.delete(id));
                return next;
            });
            if (selected && idSet.has(selected.id)) setSelected(null);
            setDeleteRequest(null);
        } catch {} finally {
            setDeleting(false);
        }
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
            setTotalCount(prev => prev - 1);
            if (selected?.id === id) setSelected(null);
        } catch {}
    };

    const handleBlockSender = async (email: string) => {
        await MailService.blockSender(email);
        setBlockedSenders(prev => new Set([...prev, email]));
    };

    const handleUnblockSender = async (email: string) => {
        await MailService.unblockSender(email);
        setBlockedSenders(prev => { const next = new Set(prev); next.delete(email); return next; });
    };

    const handleBulkDelete = async () => {
        const ids = [...checkedIds];
        if (ids.length === 0) return;
        const subject = ids.length === 1
            ? mails.find(m => m.id === ids[0])?.subject
            : undefined;
        setDeleteRequest({ ids, subject });
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
            setTotalCount(prev => prev - ids.length);
            setCheckedIds(new Set());
            if (selected && checkedIds.has(selected.id)) setSelected(null);
        } catch {}
    };

    const handleDownloadAttachment = async (att: MailAttachment) => {
        if (!selected || downloadingId === att.id) return;
        setDownloadingId(att.id);
        try { await MailService.downloadAttachment(selected.id, att.id, att.filename); }
        catch {} finally { setDownloadingId(null); }
    };

    return (
        <div className="dash-layout">
            {deleteRequest && (
                <MailDeleteModal
                    count={deleteRequest.ids.length}
                    subject={deleteRequest.subject}
                    loading={deleting}
                    onConfirm={confirmDelete}
                    onCancel={() => !deleting && setDeleteRequest(null)}
                />
            )}
            <div className="blob blob-1" />
            <div className="blob blob-2" />
            <TopBar />
            <main className="upload-drive-container mc-app">
                <MailListPanel
                    mails={displayed}
                    loading={loading}
                    folder={folder}
                    search={search}
                    sort={sort}
                    page={page}
                    totalPages={totalPages}
                    checkedIds={checkedIds}
                    selectedId={selected?.id ?? null}
                    mobileView={mobileView}
                    mailStorageMb={mailStorageMb}
                    blockedSenders={blockedSenders}
                    user={user}
                    userEmail={userEmail}
                    isAllChecked={isAllChecked}
                    anyChecked={anyChecked}
                    onFolderChange={handleFolderChange}
                    onSearchChange={setSearch}
                    onSortChange={setSort}
                    onToggleCheck={toggleCheck}
                    onToggleAll={toggleAll}
                    onSelect={handleSelect}
                    onChangePage={changePage}
                    onBulkDelete={handleBulkDelete}
                    onBulkReadStatus={handleBulkReadStatus}
                    onBulkMove={handleBulkMove}
                />
                <MailDetailPanel
                    selected={selected}
                    loadingDetail={loadingDetail}
                    downloadingId={downloadingId}
                    mobileView={mobileView}
                    folder={folder}
                    blockedSenders={blockedSenders}
                    onBack={() => { setSelected(null); setMobileView('list'); }}
                    onReadStatus={handleReadStatus}
                    onMove={handleMove}
                    onBlockSender={handleBlockSender}
                    onUnblockSender={handleUnblockSender}
                    onDelete={requestDelete}
                    onDownloadAttachment={handleDownloadAttachment}
                />
            </main>
        </div>
    );
}
