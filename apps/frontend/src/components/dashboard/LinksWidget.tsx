import { useState } from "react";

export function LinksWidget() {
    const [revealedIds, setRevealedIds] = useState<number[]>([]);

    const links = [
        { id: 1, url: "https://example.com/asdfghjklqwertzuiopyxcvbnm", short: "redbox.cx/s/9RqkW" },
        { id: 2, url: "https://example.com/asdfghjklqwertzuio", short: "redbox.cx/s/GrsT1" },
        { id: 3, url: "https://example.com/asdfghjkl", short: "redbox.cx/s/X1lpR" },
        { id: 4, url: "https://example.com/asdfgh", short: "redbox.cx/s/pa92d" }
    ];

    const toggleReveal = (id: number) => {
        setRevealedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const [copiedId, setCopiedId] = useState<number | null>(null);

    const copyText = (e: React.MouseEvent, id: number, text: string) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500); // 1.5s
    };

    const truncate = (text: string, maxLength: number) => {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
    };

    return (
        <div className="widget-wrapper">
            <div className="widget-tab"><i className="bi bi-link-45deg"></i> Your Links</div>
            <div className="glass-panel widget-box">
                <div className="widget-header">
                    <span className="count-badge-top">{links.length}/25</span>
                </div>
                <div className="links-scroll-area">
                    <div className="links-stack">
                        {links.map(link => {
                            const isRevealed = revealedIds.includes(link.id);
                            return (
                                <div key={link.id} className={`link-item ${isRevealed ? 'revealed' : ''}`}>
                                    {!isRevealed && (
                                        <div className="link-blur-overlay" onClick={() => toggleReveal(link.id)}>
                                            Click to unblur
                                        </div>
                                    )}
                                    <div className="link-content">
                                        <span className="link-orig">{truncate(link.url, 35)}</span>
                                        <span className="link-res">{link.short}</span>
                                    </div>
                                    <div className="link-actions">
                                        <button 
                                            className={`copy-icon-btn ${copiedId === link.id ? 'copied' : ''}`} 
                                            onClick={(e) => copyText(e, link.id, link.short)}>
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