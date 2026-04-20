interface Props {
    password: string;
    error: string;
    onChange: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
}

export function BinPasswordForm({ password, error, onChange, onSubmit }: Props) {
    return (
        <form className="dl-password-form" onSubmit={onSubmit}>
            <p className="dl-password-label">This bin is password-protected.</p>
            <div className="dl-password-input-wrap">
                <i className="bi bi-lock dl-password-icon" />
                <input
                    className="dl-password-input"
                    type="password"
                    placeholder="Enter password…"
                    value={password}
                    onChange={e => onChange(e.target.value)}
                    autoFocus
                    required
                />
            </div>
            {error && <p className="dl-error-msg">{error}</p>}
            <button className="dl-btn-primary" type="submit">Unlock</button>
        </form>
    );
}
