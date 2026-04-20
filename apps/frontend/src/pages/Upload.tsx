import { useEffect, useCallback, useState } from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { FileService, type FileEntry } from '../services/FileService';
import { UploadDeleteModal } from '../components/upload/UploadDeleteModal';
import { UploadFormPanel } from '../components/upload/UploadFormPanel';
import { UploadFilesPanel } from '../components/upload/UploadFilesPanel';

export function Upload() {
    const [fileList, setFileList] = useState<FileEntry[]>([]);
    const [totalUsed, setTotalUsed] = useState(0);
    const [loadingFiles, setLoadingFiles] = useState(true);
    const [filesError, setFilesError] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmEntry, setConfirmEntry] = useState<FileEntry | null>(null);

    useEffect(() => {
        document.documentElement.classList.add('dash-page');
        return () => { document.documentElement.classList.remove('dash-page'); };
    }, []);

    const loadFiles = useCallback(async () => {
        try {
            const { files, totalUsed } = await FileService.getFiles();
            setFileList(files);
            setTotalUsed(totalUsed);
            setFilesError('');
        } catch (err: any) {
            setFilesError(err?.response?.status === 401
                ? 'Session expired — please log out and log back in.'
                : 'Could not load files.');
        } finally {
            setLoadingFiles(false);
        }
    }, []);

    useEffect(() => { loadFiles(); }, [loadFiles]);

    const copyLink = (entry: FileEntry) => {
        navigator.clipboard.writeText(`${window.location.origin}${entry.shareLink}`);
        setCopiedId(entry.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const confirmDelete = async () => {
        if (!confirmEntry) return;
        const entry = confirmEntry;
        setConfirmEntry(null);
        setDeletingId(entry.id);
        try { await FileService.deleteFile(entry.id); await loadFiles(); }
        catch { /* ignore */ }
        finally { setDeletingId(null); }
    };

    return (
        <div className="dash-layout">
            {confirmEntry && (
                <UploadDeleteModal
                    entry={confirmEntry}
                    onConfirm={confirmDelete}
                    onCancel={() => setConfirmEntry(null)}
                />
            )}
            <div className="blob blob-1" />
            <div className="blob blob-2" />
            <TopBar />
            <main className="upload-drive-container">
                <UploadFormPanel totalUsed={totalUsed} onUploaded={loadFiles} />
                <UploadFilesPanel
                    files={fileList}
                    loading={loadingFiles}
                    error={filesError}
                    copiedId={copiedId}
                    deletingId={deletingId}
                    onCopy={copyLink}
                    onDelete={setConfirmEntry}
                />
            </main>
        </div>
    );
}
