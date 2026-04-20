import type { BinEntry } from '../../services/BinService';
import { MidTruncate } from '../MidTruncate';

const BIN_LIMIT = 100;

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

interface Props {
    bins: BinEntry[];
    loading: boolean;
    copiedId: string | null;
    deletingId: string | null;
    onOpen: (bin: BinEntry) => void;
    onCopyLink: (bin: BinEntry) => void;
    onDelete: (bin: BinEntry) => void;
}

export function BinList({ bins, loading, copiedId, deletingId, onOpen, onCopyLink, onDelete }: Props) {
    if (loading) {
        return <div className="empty-bins"><i className="bi bi-hourglass-split" /><span>Loading…</span></div>;
    }
    if (bins.length === 0) {
        return <div className="empty-bins"><i className="bi bi-file-text" /><span>0 / {BIN_LIMIT} bins used</span></div>;
    }
    return (
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
                        <button className="drive-action-btn" title="Open bin" onClick={() => onOpen(bin)}>
                            <i className="bi bi-box-arrow-up-right" />
                        </button>
                        <button
                            className={`drive-action-btn ${copiedId === bin.id ? 'copied' : ''}`}
                            title="Copy share link"
                            onClick={() => onCopyLink(bin)}
                        >
                            <i className={`bi bi-${copiedId === bin.id ? 'check-lg' : 'link-45deg'}`} />
                        </button>
                        <button
                            className="drive-action-btn danger"
                            title="Delete bin"
                            disabled={deletingId === bin.id}
                            onClick={() => onDelete(bin)}
                        >
                            <i className={`bi bi-${deletingId === bin.id ? 'hourglass-split' : 'trash3'}`} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
