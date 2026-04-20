interface Props {
    onStart: () => void;
}

export function DownloadIdle({ onStart }: Props) {
    return (
        <div className="dl-idle">
            <p className="dl-description">
                This file is encrypted. Only you (and whoever has this link) can decrypt it.
                The key never leaves your browser.
            </p>
            <button className="dl-primary-btn" onClick={onStart}>
                <i className="bi bi-cloud-arrow-down" /> Download & Decrypt
            </button>
        </div>
    );
}
