interface Props {
    plaintext: string;
    expiresAt: string | null;
    copied: boolean;
    onCopy: () => void;
}

function formatExpiry(iso: string | null): string {
    if (!iso) return 'Never expires';
    return `Expires ${new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}`;
}

export function BinContent({ plaintext, expiresAt, copied, onCopy }: Props) {
    return (
        <div className="bin-view-body">
            <div className="bin-view-toolbar">
                <span className="bin-view-expiry">{formatExpiry(expiresAt)}</span>
                <button
                    className={`drive-action-btn ${copied ? 'copied' : ''}`}
                    title="Copy text"
                    onClick={onCopy}
                >
                    <i className={`bi bi-${copied ? 'check-lg' : 'copy'}`} />
                </button>
            </div>
            <pre className="bin-view-pre">{plaintext}</pre>
            <div className="bin-view-footer">
                <i className="bi bi-shield-check" /> Decrypted in your browser. The server never saw this content.
            </div>
        </div>
    );
}
