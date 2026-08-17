interface Props {
    password: string;
    errorMsg: string;
    disabled?: boolean;
    onChange: (v: string) => void;
    onSubmit: (e: React.FormEvent) => void;
}

export function DownloadPasswordForm({ password, errorMsg, disabled = false, onChange, onSubmit }: Props) {
    return (
        <form className="dl-password-form" onSubmit={onSubmit}>
            <p className="dl-description">
                <i className="bi bi-lock-fill" /> Enter the file password to unlock its details.
            </p>
            {errorMsg && <div className="dl-error">{errorMsg}</div>}
            <input
                className="upload-password-input"
                type="password"
                placeholder="Enter password…"
                value={password}
                onChange={e => onChange(e.target.value)}
                minLength={1}
                maxLength={100}
                autoComplete="off"
                required
                autoFocus
                disabled={disabled}
            />
            <button className="dl-primary-btn" type="submit" disabled={disabled}>
                <i className="bi bi-unlock" /> {disabled ? 'Checking...' : 'Unlock file'}
            </button>
        </form>
    );
}
