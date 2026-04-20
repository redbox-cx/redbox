import { useState, useEffect } from 'react';
import { BinService } from '../../services/BinService';
import { BinCrypto } from '../../services/BinCrypto';
import { ReportModal } from '../ReportModal';
import { BinCardHeader } from './BinCardHeader';
import { BinPasswordForm } from './BinPasswordForm';
import { BinStatusArea } from './BinStatusArea';
import { BinContent } from './BinContent';

type State = 'loading' | 'password' | 'decrypting' | 'done' | 'error';

interface Props {
    id: string;
    token: string | undefined;
    keyHex: string;
}

export function BinViewCard({ id, token, keyHex }: Props) {
    const [state, setState] = useState<State>('loading');
    const [title, setTitle] = useState('Encrypted Bin');
    const [plaintext, setPlaintext] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
    const [isPasswordProtected, setIsPasswordProtected] = useState(false);

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
                setIsPasswordProtected(true);
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

    return (
        <>
            {reportOpen && (
                <ReportModal
                    onClose={() => setReportOpen(false)}
                    isPasswordProtected={isPasswordProtected}
                    knownPassword={isPasswordProtected && state === 'done' ? password : undefined}
                />
            )}
            <div className="bin-view-card">
                <BinCardHeader state={state} title={title} onReport={() => setReportOpen(true)} />
                <div className="dl-divider" />
                {(state === 'loading' || state === 'decrypting' || state === 'error') && (
                    <BinStatusArea state={state} errorMsg={errorMsg} onRetry={fetchAndDecrypt} />
                )}
                {state === 'password' && (
                    <BinPasswordForm
                        password={password}
                        error={passwordError}
                        onChange={setPassword}
                        onSubmit={handlePasswordSubmit}
                    />
                )}
                {state === 'done' && (
                    <BinContent plaintext={plaintext} expiresAt={expiresAt} copied={copied} onCopy={copyText} />
                )}
            </div>
        </>
    );
}
