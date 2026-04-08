import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import logoRed from '@/assets/images/logo_red.png';
import { BinService } from '../services/BinService';
import { BinCrypto } from '../services/BinCrypto';

type State = 'loading' | 'password' | 'decrypting' | 'done' | 'error';

export function BinView() {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') ?? undefined;

    const [state, setState] = useState<State>('loading');
    const [title, setTitle] = useState('Encrypted Bin');
    const [plaintext, setPlaintext] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const keyHex = window.location.hash.slice(1);

    const fetchAndDecrypt = async (pwd?: string) => {
        if (!id || !token) { setState('error'); setErrorMsg('Invalid link. Missing id or token.'); return; }
        if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
            setState('error');
            setErrorMsg('Invalid or missing decryption key in the URL fragment.');
            return;
        }

        setState('loading');
        try {
            const bin = await BinService.get(id, token, pwd);
            setState('decrypting');

            const cryptoKey = await BinCrypto.importKey(keyHex);
            const text = await BinCrypto.decryptText(cryptoKey, bin.content);

            setTitle(bin.title || 'Untitled Bin');
            setExpiresAt(bin.expiresAt);
            setPlaintext(text);
            setState('done');
        } catch (err: any) {
            const status = err.response?.status;
            if (status === 403) {
                setPasswordError(pwd ? 'Incorrect password.' : '');
                setState('password');
            } else if (status === 404) {
                setState('error');
                setErrorMsg('This bin does not exist or has expired.');
            } else {
                setState('error');
                setErrorMsg('Failed to decrypt. The key or content may be corrupted.');
            }
        }
    };

    useEffect(() => { fetchAndDecrypt(); }, []);

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        fetchAndDecrypt(password);
    };

    const copyText = async () => {
        await navigator.clipboard.writeText(plaintext);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatExpiry = (iso: string | null) => {
        if (!iso) return 'Never expires';
        return `Expires ${new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}`;
    };

    return (
        <div className="dl-page">
            <nav className="dl-nav">
                <a href="/" className="dl-nav-brand">
                    <img src={logoRed} alt="redbox" width="32" />
                    <span className="dl-nav-logo-text">redbox<span className="dot">.</span></span>
                </a>
            </nav>

            <div className="dl-body">
                <div className="bin-view-card">
                    <div className="dl-card-header">
                        <div className="dl-file-icon-wrap">
                            <i className="bi bi-file-text dl-file-icon" />
                        </div>
                        <div className="dl-file-info">
                            <p className="dl-file-name">
                                {state === 'done' ? title : 'Encrypted Bin'}
                            </p>
                            <span className="dl-e2e-badge">
                                <i className="bi bi-shield-lock-fill" /> End-to-end encrypted
                            </span>
                        </div>
                    </div>

                    <div className="dl-divider" />

                    {(state === 'loading' || state === 'decrypting') && (
                        <div className="dl-status-area">
                            <i className="bi bi-hourglass-split dl-spin-icon" />
                            <p className="dl-status-text">
                                {state === 'decrypting' ? 'Decrypting…' : 'Fetching…'}
                            </p>
                        </div>
                    )}
                    {state === 'password' && (
                        <form className="dl-password-form" onSubmit={handlePasswordSubmit}>
                            <p className="dl-password-label">This bin is password-protected.</p>
                            <div className="dl-password-input-wrap">
                                <i className="bi bi-lock dl-password-icon" />
                                <input
                                    className="dl-password-input"
                                    type="password"
                                    placeholder="Enter password…"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    autoFocus
                                    required
                                />
                            </div>
                            {passwordError && <p className="dl-error-msg">{passwordError}</p>}
                            <button className="dl-btn-primary" type="submit">Unlock</button>
                        </form>
                    )}
                    {state === 'error' && (
                        <div className="dl-status-area">
                            <i className="bi bi-exclamation-octagon dl-error-icon" />
                            <p className="dl-error-msg" style={{ textAlign: 'center' }}>{errorMsg}</p>
                            <button className="dl-btn-outline" onClick={() => fetchAndDecrypt()}>
                                <i className="bi bi-arrow-clockwise" /> Try again
                            </button>
                        </div>
                    )}
                    {state === 'done' && (
                        <div className="bin-view-body">
                            <div className="bin-view-toolbar">
                                <span className="bin-view-expiry">{formatExpiry(expiresAt)}</span>
                                <button
                                    className={`drive-action-btn ${copied ? 'copied' : ''}`}
                                    title="Copy text"
                                    onClick={copyText}
                                >
                                    <i className={`bi bi-${copied ? 'check-lg' : 'copy'}`} />
                                </button>
                            </div>
                            <pre className="bin-view-pre">{plaintext}</pre>
                            <div className="bin-view-footer">
                                <i className="bi bi-shield-check" /> Decrypted in your browser. The server never saw this content.
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
