import { useState, useEffect } from "react";
import { LinkService, type Link } from "../../services/LinkService";

const LINK_LIMIT = 25;

export function LinksWidget() {
    const [links, setLinks] = useState<Link[]>([]);
    const [loading, setLoading] = useState(true);
    const [revealedIds, setRevealedIds] = useState<string[]>([]);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        LinkService.getAll()
            .then(setLinks)
            .finally(() => setLoading(false));
    }, []);

    const toggleReveal = (id: string) => {
        setRevealedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const copyText = (e: React.MouseEvent, id: string, text: string) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
    };

    const truncate = (text: string, maxLength: number) => {
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
    };

    const getShortUrl = (shortCode: string) =>
        `${window.location.origin}/s/${shortCode}`;

    return (
        <div className="widget-wrapper">
            <div className="widget-tab"><i className="bi bi-link-45deg"></i> Your Links</div>
            <div className="glass-panel widget-box">
                <div className="widget-header">
                    <span className={`red-badge ${links.length === 0 ? 'zero' : ''}`}>{links.length}/{LINK_LIMIT}</span>
                </div>
                <div className="links-scroll-area">
                    <div className="links-stack">
                        {loading ? (
                            <div className="empty-bins">
                                <i className="bi bi-hourglass-split"></i>
                                <span>Loading...</span>
                            </div>
                        ) : links.length === 0 ? (
                            <div className="empty-bins">
                                <i className="bi bi-link-45deg"></i>
                                <span>0/{LINK_LIMIT} Links available</span>
                            </div>
                        ) : links.map(link => {
                            const isRevealed = revealedIds.includes(link.id);
                            const shortUrl = getShortUrl(link.shortCode);
                            return (
                                <div key={link.id} className={`link-item ${isRevealed ? 'revealed' : ''}`}>
                                    {!isRevealed && (
                                        <div className="link-blur-overlay" onClick={() => toggleReveal(link.id)}>
                                            Click to unblur
                                        </div>
                                    )}
                                    <div className="link-content">
                                        <span className="link-orig">{truncate(link.originalUrl, 35)}</span>
                                        <span className="link-res">{shortUrl}</span>
                                    </div>
                                    <div className="link-actions">
                                        <button
                                            className={`copy-icon-btn ${copiedId === link.id ? 'copied' : ''}`}
                                            onClick={(e) => copyText(e, link.id, shortUrl)}>
                                            <i className={`bi bi-${copiedId === link.id ? 'check-lg' : 'copy'}`}></i>
                                        </button>
                                        <button className="reblur-btn" onClick={() => toggleReveal(link.id)} title="Blur">
                                            <i className="bi bi-eye-slash"></i>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
