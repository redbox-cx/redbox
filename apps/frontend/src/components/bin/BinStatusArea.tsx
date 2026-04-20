interface Props {
    state: 'loading' | 'decrypting' | 'error';
    errorMsg: string;
    onRetry: () => void;
}

export function BinStatusArea({ state, errorMsg, onRetry }: Props) {
    if (state === 'loading' || state === 'decrypting') {
        return (
            <div className="dl-status-area">
                <i className="bi bi-hourglass-split dl-spin-icon" />
                <p className="dl-status-text">
                    {state === 'decrypting' ? 'Decrypting…' : 'Fetching…'}
                </p>
            </div>
        );
    }

    return (
        <div className="dl-status-area">
            <i className="bi bi-exclamation-octagon dl-error-icon" />
            <p className="dl-error-msg" style={{ textAlign: 'center' }}>{errorMsg}</p>
            <button className="dl-btn-outline" onClick={onRetry}>
                <i className="bi bi-arrow-clockwise" /> Try again
            </button>
        </div>
    );
}
