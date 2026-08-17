interface Props {
    stage: 'downloading' | 'finalizing';
    progress: number | null;
    onCancel?: () => void;
}

export function DownloadProgress({ stage, progress, onCancel }: Props) {
    const isIndeterminate = progress === null;
    const displayProgress = isIndeterminate ? null : Math.max(0, Math.min(100, progress));

    return (
        <div className="dl-progress-area">
            <div className="dl-progress-icon-wrap">
                <i className={`bi ${stage === 'finalizing' ? 'bi-device-ssd' : 'bi-cloud-download'} dl-progress-icon`} />
            </div>
            <p className="upload-phase-label">
                {stage === 'finalizing' ? 'Finalizing file...' : 'Downloading, decrypting & saving...'}
            </p>
            <div className="upload-progress-track">
                <div
                    className={`upload-progress-fill ${isIndeterminate ? 'indeterminate' : ''}`}
                    style={isIndeterminate ? undefined : { width: `${displayProgress}%` }}
                />
            </div>
            <span className="upload-progress-pct">
                {isIndeterminate ? 'Streaming encrypted file' : `${displayProgress}%`}
            </span>
            {onCancel && (
                <button className="dl-secondary-btn" type="button" onClick={onCancel}>
                    <i className="bi bi-x-circle" /> Cancel
                </button>
            )}
        </div>
    );
}
