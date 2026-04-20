import type { FileEntry } from '../../services/FileService';
import { MidTruncate } from '../MidTruncate';

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const s = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function getFileIcon(mime: string): string {
    if (mime.startsWith('image/')) return 'bi-file-image';
    if (mime.startsWith('video/')) return 'bi-file-play';
    if (mime.startsWith('audio/')) return 'bi-file-music';
    if (mime.includes('pdf')) return 'bi-file-pdf';
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z')) return 'bi-file-zip';
    if (mime.includes('text') || mime.includes('json') || mime.includes('xml')) return 'bi-file-code';
    return 'bi-file-earmark';
}

interface Props {
    files: FileEntry[];
    loading: boolean;
    error: string;
    copiedId: string | null;
    deletingId: string | null;
    onCopy: (entry: FileEntry) => void;
    onDelete: (entry: FileEntry) => void;
}

export function UploadFilesPanel({ files, loading, error, copiedId, deletingId, onCopy, onDelete }: Props) {
    return (
        <div className="upload-drive-right">
            <div className="widget-tab"><i className="bi bi-folder2-open" /> Your Files</div>
            <div className="glass-panel upload-files-panel">
                {loading ? (
                    <div className="empty-bins"><i className="bi bi-hourglass-split" /><span>Loading…</span></div>
                ) : error ? (
                    <div className="empty-bins"><i className="bi bi-exclamation-triangle" /><span>{error}</span></div>
                ) : files.length === 0 ? (
                    <div className="empty-bins"><i className="bi bi-cloud-slash" /><span>No files yet</span></div>
                ) : (
                    <div className="drive-file-list">
                        {files.map(entry => (
                            <div key={entry.id} className="drive-file-row">
                                <i className={`bi ${getFileIcon(entry.mimetype)} drive-file-type-icon`} />
                                <div className="drive-file-meta">
                                    <MidTruncate text={entry.originalName} className="drive-file-name" />
                                    <span className="drive-file-detail">
                                        {formatBytes(entry.size)} · Expires {formatDate(entry.expiresAt)}
                                    </span>
                                </div>
                                <div className="drive-file-actions">
                                    <button className={`drive-action-btn ${copiedId === entry.id ? 'copied' : ''}`}
                                        title="Copy share link" onClick={() => onCopy(entry)}>
                                        <i className={`bi bi-${copiedId === entry.id ? 'check-lg' : 'link-45deg'}`} />
                                    </button>
                                    <button className="drive-action-btn danger" title="Delete file"
                                        disabled={deletingId === entry.id} onClick={() => onDelete(entry)}>
                                        <i className={`bi bi-${deletingId === entry.id ? 'hourglass-split' : 'trash3'}`} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
