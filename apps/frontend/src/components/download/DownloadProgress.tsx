interface Props {
    stage: 'downloading' | 'decrypting';
    progress: number | null;
}

export function DownloadProgress({ stage, progress }: Props) {
    const isIndeterminate = progress === null;
    const displayProgress = isIndeterminate ? null : Math.max(0, Math.min(100, progress));

    return (
        <div className="dl-progress-area">
            <div className="dl-progress-icon-wrap">
                <i className={`bi ${stage === 'decrypting' ? 'bi-shield-shaded' : 'bi-cloud-download'} dl-progress-icon`} />
            </div>
            <p className="upload-phase-label">
                {stage === 'decrypting' ? 'Decrypting…' : 'Downloading…'}
            </p>
            <div className="upload-progress-track">
                <div
                    className={`upload-progress-fill ${isIndeterminate ? 'indeterminate' : ''}`}
                    style={isIndeterminate ? undefined : { width: `${displayProgress}%` }}
                />
            </div>
            <span className="upload-progress-pct">
                {isIndeterminate ? 'Receiving encrypted file' : `${displayProgress}%`}
            </span>
        </div>
    );
}
