type State = 'loading' | 'password' | 'decrypting' | 'done' | 'error';

interface Props {
    state: State;
    title: string;
    onReport: () => void;
}

export function BinCardHeader({ state, title, onReport }: Props) {
    return (
        <div className="dl-card-header">
            <div className="dl-file-icon-wrap">
                <i className="bi bi-file-text dl-file-icon" />
            </div>
            <div className="dl-file-info">
                <p className="dl-file-name">
                    {state === 'done' ? title : 'Encrypted Bin'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="dl-e2e-badge">
                        <i className="bi bi-shield-lock-fill" /> End-to-end encrypted
                    </span>
                    {state === 'done' && (
                        <button className="dl-card-report-btn" onClick={onReport} title="Report content">
                            <i className="bi bi-flag" /> Report
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
