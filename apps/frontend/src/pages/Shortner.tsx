import { useState, useEffect } from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { LinkService, type Link } from '../services/LinkService';
import { ShortnerDeleteModal } from '../components/shortner/ShortnerDeleteModal';
import { ShortnerFormPanel } from '../components/shortner/ShortnerFormPanel';
import { ShortnerLinksPanel } from '../components/shortner/ShortnerLinksPanel';

export function Shortner() {
    const [links, setLinks] = useState<Link[]>([]);
    const [loading, setLoading] = useState(true);
    const [url, setUrl] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmEntry, setConfirmEntry] = useState<Link | null>(null);

    useEffect(() => {
        document.documentElement.classList.add('dash-page');
        return () => { document.documentElement.classList.remove('dash-page'); };
    }, []);

    const loadLinks = async () => {
        try { setLinks(await LinkService.getAll()); }
        catch { /* ignore */ }
        finally { setLoading(false); }
    };

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
        navigator.clipboard.writeText(`${window.location.origin}/s/${link.shortCode}`);
        setCopiedId(link.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const confirmDelete = async () => {
        if (!confirmEntry) return;
        const entry = confirmEntry;
        setConfirmEntry(null);
        setDeletingId(entry.id);
        try { await LinkService.deleteLink(entry.id); await loadLinks(); }
        catch { /* ignore */ }
        finally { setDeletingId(null); }
    };

    return (
        <div className="dash-layout">
            {confirmEntry && (
                <ShortnerDeleteModal
                    entry={confirmEntry}
                    onConfirm={confirmDelete}
                    onCancel={() => setConfirmEntry(null)}
                />
            )}
            <div className="blob blob-1" />
            <div className="blob blob-2" />
            <TopBar />
            <main className="upload-drive-container">
                <ShortnerFormPanel
                    url={url}
                    linkCount={links.length}
                    creating={creating}
                    error={error}
                    onUrlChange={setUrl}
                    onSubmit={handleCreate}
                />
                <ShortnerLinksPanel
                    links={links}
                    loading={loading}
                    copiedId={copiedId}
                    deletingId={deletingId}
                    onCopy={copyLink}
                    onDelete={setConfirmEntry}
                />
            </main>
        </div>
    );
}
