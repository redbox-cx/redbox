type Stage = 'idle' | 'password' | 'downloading' | 'decrypting' | 'preview' | 'error';

function formatBytes(bytes: number): string {
    if (!bytes) return '';
    const k = 1024;
    const s = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
}

export function getIcon(mime: string): string {
    if (mime.startsWith('image/')) return 'bi-file-image';
    if (mime.startsWith('video/')) return 'bi-file-play';
    if (mime.startsWith('audio/')) return 'bi-file-music';
    if (mime.includes('pdf')) return 'bi-file-pdf';
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z')) return 'bi-file-zip';
    if (mime.includes('text') || mime.includes('json') || mime.includes('xml')) return 'bi-file-code';
    return 'bi-file-earmark';
}

interface Props {
    stage: Stage;
    fileName: string;
    mimeType: string;
    fileSize: number;
    onReport: () => void;
}

export function DownloadCardHeader({ stage, fileName, mimeType, fileSize, onReport }: Props) {
    return (
        <div className="dl-card-header">
            <div className={`dl-file-icon-wrap ${mimeType ? '' : 'unknown'}`}>
                <i className={`bi ${mimeType ? getIcon(mimeType) : 'bi-file-earmark-lock2'}`} />
            </div>
            <div className="dl-file-meta">
                <h2 className="dl-file-name">{fileName || 'Encrypted File'}</h2>
                <div className="dl-file-badges">
                    {fileSize > 0 && <span className="dl-badge">{formatBytes(fileSize)}</span>}
                    <span className="dl-badge encrypted"><i className="bi bi-shield-lock-fill" /> End-to-end encrypted</span>
                    {stage === 'preview' && (
                        <button className="dl-card-report-btn" onClick={onReport} title="Report content">
                            <i className="bi bi-flag" /> Report
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
