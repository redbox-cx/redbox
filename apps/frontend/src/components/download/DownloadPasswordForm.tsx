interface Props {
    password: string;
    errorMsg: string;
    onChange: (v: string) => void;
    onSubmit: (e: React.FormEvent) => void;
}

export function DownloadPasswordForm({ password, errorMsg, onChange, onSubmit }: Props) {
    return (
        <form className="dl-password-form" onSubmit={onSubmit}>
            <p className="dl-description"><i className="bi bi-lock-fill" /> This file is password protected.</p>
            {errorMsg && <div className="dl-error">{errorMsg}</div>}
            <input
                className="upload-password-input"
                type="password"
                placeholder="Enter password…"
                value={password}
                onChange={e => onChange(e.target.value)}
                autoFocus
            />
            <button className="dl-primary-btn" type="submit">
                <i className="bi bi-unlock" /> Unlock & Download
            </button>
        </form>
    );
}
