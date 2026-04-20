interface Props {
    stage: 'downloading' | 'decrypting';
    progress: number;
}

export function DownloadProgress({ stage, progress }: Props) {
    return (
        <div className="dl-progress-area">
            <div className="dl-progress-icon-wrap">
                <i className={`bi ${stage === 'decrypting' ? 'bi-shield-shaded' : 'bi-cloud-download'} dl-progress-icon`} />
            </div>
            <p className="upload-phase-label">
                {stage === 'decrypting' ? 'Decrypting…' : 'Downloading…'}
            </p>
            <div className="upload-progress-track">
                <div className="upload-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="upload-progress-pct">{progress}%</span>
        </div>
    );
}
