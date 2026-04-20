import type { Link } from '../../services/LinkService';
import { MidTruncate } from '../MidTruncate';

const LINK_LIMIT = 25;

function getShortUrl(code: string) {
    return `${window.location.origin}/s/${code}`;
}

interface Props {
    links: Link[];
    loading: boolean;
    copiedId: string | null;
    deletingId: string | null;
    onCopy: (link: Link) => void;
    onDelete: (link: Link) => void;
}

export function ShortnerLinksPanel({ links, loading, copiedId, deletingId, onCopy, onDelete }: Props) {
    return (
        <div className="upload-drive-right">
            <div className="widget-tab"><i className="bi bi-collection" /> Your Links</div>
            <div className="glass-panel upload-files-panel">
                {loading ? (
                    <div className="empty-bins"><i className="bi bi-hourglass-split" /><span>Loading…</span></div>
                ) : links.length === 0 ? (
                    <div className="empty-bins"><i className="bi bi-link-45deg" /><span>0 / {LINK_LIMIT} links used</span></div>
                ) : (
                    <div className="drive-file-list">
                        {links.map(link => (
                            <div key={link.id} className="drive-file-row">
                                <i className="bi bi-link-45deg drive-file-type-icon" />
                                <div className="drive-file-meta">
                                    <MidTruncate text={link.originalUrl} className="drive-file-name" />
                                    <span className="drive-file-detail shr-short-url">{getShortUrl(link.shortCode)}</span>
                                </div>
                                <div className="drive-file-actions">
                                    <button
                                        className={`drive-action-btn ${copiedId === link.id ? 'copied' : ''}`}
                                        title="Copy short link"
                                        onClick={() => onCopy(link)}
                                    >
                                        <i className={`bi bi-${copiedId === link.id ? 'check-lg' : 'copy'}`} />
                                    </button>
                                    <button
                                        className="drive-action-btn danger"
                                        title="Delete link"
                                        disabled={deletingId === link.id}
                                        onClick={() => onDelete(link)}
                                    >
                                        <i className={`bi bi-${deletingId === link.id ? 'hourglass-split' : 'trash3'}`} />
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
