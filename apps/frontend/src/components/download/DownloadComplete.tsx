interface Props {
    fileName: string;
    browserManaged?: boolean;
    onDownloadAnotherCopy: () => void;
}

export function DownloadComplete({ fileName, browserManaged = false, onDownloadAnotherCopy }: Props) {
    return (
        <div className="dl-preview-area">
            <div className="dl-preview-actions">
                <p className="dl-success-msg">
                    <i className="bi bi-patch-check-fill" /> {browserManaged
                        ? `${fileName} was decrypted and sent to your browser's download manager`
                        : `${fileName} was decrypted and saved successfully`}
                </p>
                <button className="dl-secondary-btn" onClick={onDownloadAnotherCopy}>
                    <i className="bi bi-download" /> Save another copy
                </button>
            </div>
        </div>
    );
}
