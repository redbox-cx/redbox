interface Props {
    previewUrl: string;
    mimeType: string;
    fileName: string;
    decryptedBlob: Blob | null;
    onSave: () => void;
}

export function DownloadPreview({ previewUrl, mimeType, fileName, decryptedBlob, onSave }: Props) {
    return (
        <div className="dl-preview-area">
            {previewUrl && mimeType.startsWith('image/') && (
                <img src={previewUrl} alt={fileName} className="dl-preview-image" />
            )}
            {previewUrl && mimeType.startsWith('video/') && (
                <video src={previewUrl} controls className="dl-preview-video" />
            )}
            {previewUrl && mimeType.startsWith('audio/') && (
                <audio src={previewUrl} controls className="dl-preview-audio" />
            )}
            {previewUrl && mimeType.includes('pdf') && (
                <iframe src={previewUrl} title={fileName} className="dl-preview-pdf" />
            )}
            <div className="dl-preview-actions">
                <p className="dl-success-msg"><i className="bi bi-patch-check-fill" /> Decrypted successfully</p>
                {decryptedBlob && (
                    <button className="dl-primary-btn" onClick={onSave}>
                        <i className="bi bi-download" /> Save file
                    </button>
                )}
            </div>
        </div>
    );
}
