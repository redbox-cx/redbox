interface Props {
    onStart: () => void;
    disabled?: boolean;
    disabledLabel?: string;
    notice?: string;
}

export function DownloadIdle({ onStart, disabled = false, disabledLabel, notice }: Props) {
    return (
        <div className="dl-idle">
            <p className="dl-description">
                This file was encrypted in the uploader's browser. It stays encrypted while downloading
                and is decrypted chunk by chunk locally before being written to disk.
            </p>
            {notice && <div className="dl-error">{notice}</div>}
            <button className="dl-primary-btn" onClick={onStart} disabled={disabled}>
                <i className="bi bi-cloud-arrow-down" /> {disabled ? disabledLabel ?? 'Loading file...' : 'Download & Decrypt'}
            </button>
        </div>
    );
}
