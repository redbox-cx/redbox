import { ExpiryDropdown } from './ExpiryDropdown';

const BIN_LIMIT = 100;

interface Props {
    title: string;
    content: string;
    password: string;
    showPassword: boolean;
    expiresIn: string;
    creating: boolean;
    error: string;
    binCount: number;
    onTitleChange: (v: string) => void;
    onContentChange: (v: string) => void;
    onPasswordChange: (v: string) => void;
    onShowPasswordToggle: () => void;
    onExpiresInChange: (v: string) => void;
    onSubmit: (e: React.FormEvent) => void;
}

export function BinWriteForm({
    title, content, password, showPassword, expiresIn,
    creating, error, binCount,
    onTitleChange, onContentChange, onPasswordChange,
    onShowPasswordToggle, onExpiresInChange, onSubmit,
}: Props) {
    return (
        <form className="bin-form" onSubmit={onSubmit}>
            <input
                className="bin-title-input"
                type="text"
                placeholder="Title (optional)"
                value={title}
                onChange={e => onTitleChange(e.target.value)}
                disabled={creating}
                maxLength={100}
            />
            <textarea
                className="bin-textarea"
                placeholder="Paste or type your text here…"
                value={content}
                onChange={e => onContentChange(e.target.value)}
                disabled={creating}
                maxLength={2000000}
                required
            />
            <span className="bin-char-count">{content.length.toLocaleString()} / 2,000,000</span>

            <div className="bin-options-row">
                <ExpiryDropdown value={expiresIn} onChange={onExpiresInChange} disabled={creating} />
                <button
                    type="button"
                    className={`upload-password-toggle ${showPassword ? 'active' : ''}`}
                    onClick={onShowPasswordToggle}
                    disabled={creating}
                >
                    <i className={`bi bi-lock${showPassword ? '-fill' : ''}`} />
                    {showPassword ? 'Password on' : 'Add password'}
                </button>
            </div>

            {showPassword && (
                <div className="shr-input-wrap">
                    <i className="bi bi-shield-lock shr-input-icon" />
                    <input
                        className="shr-input"
                        type="password"
                        placeholder="Password…"
                        value={password}
                        onChange={e => onPasswordChange(e.target.value)}
                        disabled={creating}
                        maxLength={100}
                    />
                </div>
            )}

            {error && <p className="upload-error"><i className="bi bi-exclamation-triangle" /> {error}</p>}

            <button
                className="upload-submit-btn"
                type="submit"
                disabled={creating || !content.trim() || binCount >= BIN_LIMIT}
            >
                <i className="bi bi-shield-lock" />
                {creating ? 'Encrypting…' : 'Encrypt & Save'}
            </button>
        </form>
    );
}
