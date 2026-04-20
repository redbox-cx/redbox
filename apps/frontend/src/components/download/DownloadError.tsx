interface Props {
    errorMsg: string;
    onRetry: () => void;
}

export function DownloadError({ errorMsg, onRetry }: Props) {
    return (
        <div className="dl-error-area">
            <i className="bi bi-exclamation-octagon dl-error-icon" />
            <p className="dl-error-msg">{errorMsg}</p>
            <button className="dl-secondary-btn" onClick={onRetry}>
                <i className="bi bi-arrow-counterclockwise" /> Try again
            </button>
        </div>
    );
}
