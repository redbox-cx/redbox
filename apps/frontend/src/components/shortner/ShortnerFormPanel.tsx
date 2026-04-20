const LINK_LIMIT = 25;

interface Props {
    url: string;
    linkCount: number;
    creating: boolean;
    error: string;
    onUrlChange: (v: string) => void;
    onSubmit: (e: React.FormEvent) => void;
}

export function ShortnerFormPanel({ url, linkCount, creating, error, onUrlChange, onSubmit }: Props) {
    const usedPct = Math.min((linkCount / LINK_LIMIT) * 100, 100);

    return (
        <div className="upload-drive-left">
            <div className="widget-tab"><i className="bi bi-link-45deg" /> Shortner</div>
            <div className="glass-panel upload-panel">
                <div className="shr-hero">
                    <i className="bi bi-scissors shr-hero-icon" />
                    <p className="shr-hero-title">Shorten a URL</p>
                    <p className="shr-hero-sub">Paste any link below and get a short shareable URL instantly.</p>
                </div>

                <form className="shr-form" onSubmit={onSubmit}>
                    <div className="shr-input-wrap">
                        <i className="bi bi-globe2 shr-input-icon" />
                        <input
                            className="shr-input"
                            type="url"
                            placeholder="https://example.com/"
                            value={url}
                            onChange={e => onUrlChange(e.target.value)}
                            disabled={creating}
                            required
                        />
                    </div>
                    {error && <p className="upload-error"><i className="bi bi-exclamation-triangle" /> {error}</p>}
                    <button className="upload-submit-btn" type="submit" disabled={creating || linkCount >= LINK_LIMIT}>
                        <i className="bi bi-scissors" />
                        {creating ? 'Shortening…' : 'Shorten URL'}
                    </button>
                </form>

                <div className="upload-quota">
                    <div className="upload-quota-labels">
                        <span>{linkCount} links used</span>
                        <span>{LINK_LIMIT} total</span>
                    </div>
                    <div className="upload-quota-track">
                        <div className="upload-quota-fill" style={{ width: `${usedPct}%` }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
