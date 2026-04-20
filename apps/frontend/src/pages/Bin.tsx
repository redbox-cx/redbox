import { useState, useEffect } from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { BinService, type BinEntry } from '../services/BinService';
import { BinCrypto } from '../services/BinCrypto';
import { BinDeleteModal } from '../components/bin/BinDeleteModal';
import { BinEditorPanel } from '../components/bin/BinEditorPanel';
import { BinFilesPanel } from '../components/bin/BinFilesPanel';

export function Bin() {
    const [bins, setBins] = useState<BinEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmEntry, setConfirmEntry] = useState<BinEntry | null>(null);

    useEffect(() => {
        document.documentElement.classList.add('dash-page');
        return () => { document.documentElement.classList.remove('dash-page'); };
    }, []);

    const loadBins = async () => {
        try { setBins(await BinService.getAll()); }
        catch { /* ignore */ }
        finally { setLoading(false); }
    };

    useEffect(() => { loadBins(); }, []);

    const handleSave = async ({ title, content, password, expiresIn }: {
        title: string; content: string; password: string; expiresIn: string;
    }) => {
        const { cryptoKey, keyHex } = await BinCrypto.generateBinKey();
        const encryptedContent = await BinCrypto.encryptText(cryptoKey, content);
        const size = new TextEncoder().encode(content).byteLength;
        await BinService.create({
            content: encryptedContent, size,
            title: title.trim() || undefined,
            password: password || undefined,
            expiresIn, binKey: keyHex,
        });
        await loadBins();
    };

    const copyLink = async (bin: BinEntry) => {
        await navigator.clipboard.writeText(`${window.location.origin}${bin.shareLink}`);
        setCopiedId(bin.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const confirmDelete = async () => {
        if (!confirmEntry) return;
        const entry = confirmEntry;
        setConfirmEntry(null);
        setDeletingId(entry.id);
        try { await BinService.deleteBin(entry.id); await loadBins(); }
        catch { /* ignore */ }
        finally { setDeletingId(null); }
    };

    return (
        <div className="dash-layout">
            {confirmEntry && (
                <BinDeleteModal
                    entry={confirmEntry}
                    onConfirm={confirmDelete}
                    onCancel={() => setConfirmEntry(null)}
                />
            )}
            <div className="blob blob-1" />
            <div className="blob blob-2" />
            <TopBar />
            <main className="upload-drive-container bin-drive-container">
                <BinEditorPanel binCount={bins.length} onSave={handleSave} />
                <BinFilesPanel
                    bins={bins}
                    loading={loading}
                    copiedId={copiedId}
                    deletingId={deletingId}
                    onOpen={bin => window.open(`${window.location.origin}${bin.shareLink}`, '_blank')}
                    onCopyLink={copyLink}
                    onDelete={setConfirmEntry}
                />
            </main>
        </div>
    );
}
