import { useState, useEffect } from "react";
import { BinService, type BinEntry } from "../../services/BinService";

const BIN_LIMIT = 100;

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024, s = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
}

function formatExpiry(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function BinsWidget() {
    const [bins, setBins] = useState<BinEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        BinService.getAll()
            .then(setBins)
            .finally(() => setLoading(false));
    }, []);

    const copyLink = (e: React.MouseEvent, bin: BinEntry) => {
        e.stopPropagation();
        navigator.clipboard.writeText(`${window.location.origin}${bin.shareLink}`);
        setCopiedId(bin.id);
        setTimeout(() => setCopiedId(null), 1500);
    };

    const openBin = (bin: BinEntry) => {
        window.open(`${window.location.origin}${bin.shareLink}`, '_blank');
    };

    return (
        <div className="widget-wrapper">
            <div className="widget-tab"><i className="bi bi-file-text"></i> Created Bins</div>
            <div className="glass-panel widget-box">
                <div className="widget-header">
                    <span className={`red-badge ${bins.length === 0 ? 'zero' : ''}`}>
                        {bins.length}/{BIN_LIMIT}
                    </span>
                </div>
                <div className="links-scroll-area">
                    <div className="links-stack">
                        {loading ? (
                            <div className="empty-bins">
                                <i className="bi bi-hourglass-split"></i>
                                <span>Loading…</span>
                            </div>
                        ) : bins.length === 0 ? (
                            <div className="empty-bins">
                                <i className="bi bi-file-text"></i>
                                <span>0/{BIN_LIMIT} bins available</span>
                            </div>
                        ) : bins.map(bin => (
                            <div key={bin.id} className="bin-widget-item" onClick={() => openBin(bin)}>
                                <div className="bin-widget-icon">
                                    <i className="bi bi-file-text"></i>
                                </div>
                                <div className="bin-widget-info">
                                    <span className="bin-widget-title">{bin.title || 'Untitled Bin'}</span>
                                    <span className="bin-widget-meta">
                                        {formatBytes(bin.size)} · Expires {formatExpiry(bin.expiresAt)}
                                    </span>
                                </div>
                                <div className="bin-widget-actions">
                                    <button
                                        className={`copy-icon-btn ${copiedId === bin.id ? 'copied' : ''}`}
                                        onClick={(e) => copyLink(e, bin)}
                                        title="Copy share link"
                                    >
                                        <i className={`bi bi-${copiedId === bin.id ? 'check-lg' : 'link-45deg'}`}></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
