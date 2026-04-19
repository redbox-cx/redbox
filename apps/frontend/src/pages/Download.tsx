import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CryptoService } from '../services/CryptoService';
import { ENCRYPTED_CHUNK_SIZE } from '../services/FileService';
import logoRed from '../assets/images/logo_red.png';
import { ReportModal } from '../components/ReportModal';

type Stage = 'idle' | 'password' | 'downloading' | 'decrypting' | 'preview' | 'error';

function formatBytes(bytes: number): string {
    if (!bytes) return '';
    const k = 1024;
    const s = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
}

function getIcon(mime: string): string {
    if (mime.startsWith('image/')) return 'bi-file-image';
    if (mime.startsWith('video/')) return 'bi-file-play';
    if (mime.startsWith('audio/')) return 'bi-file-music';
    if (mime.includes('pdf')) return 'bi-file-pdf';
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z')) return 'bi-file-zip';
    if (mime.includes('text') || mime.includes('json') || mime.includes('xml')) return 'bi-file-code';
    return 'bi-file-earmark';
}

function canPreview(mime: string): boolean {
    return mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/') || mime.includes('pdf');
}

export function Download() {
    const { fileId } = useParams<{ fileId: string }>();
    const [stage, setStage] = useState<Stage>('idle');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [progress, setProgress] = useState(0);
    const [fileName, setFileName] = useState('');
    const [mimeType, setMimeType] = useState('');
    const [fileSize, setFileSize] = useState(0);
    const [previewUrl, setPreviewUrl] = useState('');
    const [decryptedBlob, setDecryptedBlob] = useState<Blob | null>(null);
    const downloadLinkRef = useRef<HTMLAnchorElement>(null);
    const [reportOpen, setReportOpen] = useState(false);
    const [isPasswordProtected, setIsPasswordProtected] = useState(false);

    const token = new URLSearchParams(window.location.search).get('token') ?? '';
    const keyHex = window.location.hash.slice(1);

    const buildUrl = (pwd?: string) => {
        const base = `${import.meta.env.VITE_API_URL}/files/download/${fileId}?token=${token}`;
        return pwd ? `${base}&password=${encodeURIComponent(pwd)}` : base;
    };

    const parseFileName = (contentDisposition: string | null): string => {
        if (!contentDisposition) return 'download';
        const rfc5987 = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (rfc5987) return decodeURIComponent(rfc5987[1].trim());
        const ascii = contentDisposition.match(/filename="([^"]+)"/);
        return ascii?.[1] ?? 'download';
    };

    const startDownload = async (pwd?: string) => {
        if (!keyHex || keyHex.length !== 64) {
            setErrorMsg('Invalid or missing decryption key in the URL fragment.');
            setStage('error');
            return;
        }

        setStage('downloading');
        setProgress(0);
        setErrorMsg('');

        try {
            const response = await fetch(buildUrl(pwd), {
                headers: { Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}` },
            });

            if (response.status === 403) {
                setIsPasswordProtected(true);
                setStage('password');
                if (pwd) setErrorMsg('Incorrect password. Try again.');
                return;
            }

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            // Extract metadata from headers
            const name = parseFileName(response.headers.get('content-disposition'));
            const mime = response.headers.get('content-type') ?? 'application/octet-stream';
            const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10);
            setFileName(name);
            setMimeType(mime);
            setFileSize(contentLength);

            // Stream body into ArrayBuffer with progress
            const reader = response.body!.getReader();
            const chunks: Uint8Array[] = [];
            let received = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                received += value.length;
                if (contentLength > 0) {
                    setProgress(Math.round((received / contentLength) * 50));
                }
            }

            // Combine stream chunks into single buffer
            const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
            const encryptedBuffer = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) { encryptedBuffer.set(chunk, offset); offset += chunk.length; }

            // Decrypt
            setStage('decrypting');
            const cryptoKey = await CryptoService.importKey(keyHex);
            const decryptedChunks: Uint8Array[] = [];
            let pos = 0;

            while (pos < encryptedBuffer.byteLength) {
                const end = Math.min(pos + ENCRYPTED_CHUNK_SIZE, encryptedBuffer.byteLength);
                const encChunk = encryptedBuffer.buffer.slice(
                    encryptedBuffer.byteOffset + pos,
                    encryptedBuffer.byteOffset + end
                );
                const decrypted = await CryptoService.decryptChunk(cryptoKey, encChunk);
                decryptedChunks.push(new Uint8Array(decrypted));
                pos = end;
                setProgress(50 + Math.round((pos / encryptedBuffer.byteLength) * 50)); // 2.te 50% = decrypt
            }

            const blob = new Blob(decryptedChunks as unknown as BlobPart[], { type: mime });
            setDecryptedBlob(blob);

            if (canPreview(mime)) {
                setPreviewUrl(URL.createObjectURL(blob));
                setStage('preview');
            } else {
                triggerDownload(blob, name);
                setStage('preview');
            }
        } catch (err: any) {
            setErrorMsg(err?.message ?? 'Download or decryption failed.');
            setStage('error');
        }
    };

    const triggerDownload = (blob: Blob, name: string) => {
        const url = URL.createObjectURL(blob);
        const a = downloadLinkRef.current!;
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    };

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        startDownload(password);
    };

    // Clean up object URLs on unmount
    useEffect(() => {
        return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    }, [previewUrl]);

    return (
        <div className="dl-page">
            <a ref={downloadLinkRef} style={{ display: 'none' }}>hidden</a>

            <nav className="dl-nav">
                <a href="/" className="dl-nav-brand">
                    <img src={logoRed} alt="redbox" width="32" />
                    <span className="logo-text" style={{ display: 'inline' }}>redbox<span className="dot">.</span></span>
                </a>
            </nav>
            {reportOpen && <ReportModal onClose={() => setReportOpen(false)} isPasswordProtected={isPasswordProtected} knownPassword={isPasswordProtected && stage !== 'password' && stage !== 'idle' ? password : undefined} />}

            <main className="dl-main">
                <div className="dl-card">
                    {/* Card header */}
                    <div className="dl-card-header">
                        <div className={`dl-file-icon-wrap ${mimeType ? '' : 'unknown'}`}>
                            <i className={`bi ${mimeType ? getIcon(mimeType) : 'bi-file-earmark-lock2'}`} />
                        </div>
                        <div className="dl-file-meta">
                            <h2 className="dl-file-name">{fileName || 'Encrypted File'}</h2>
                            <div className="dl-file-badges">
                                {fileSize > 0 && <span className="dl-badge">{formatBytes(fileSize)}</span>}
                                <span className="dl-badge encrypted"><i className="bi bi-shield-lock-fill" /> End-to-end encrypted</span>
                                {stage === 'preview' && (
                                    <button className="dl-card-report-btn" onClick={() => setReportOpen(true)} title="Report content">
                                        <i className="bi bi-flag" /> Report
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* States */}
                    {stage === 'idle' && (
                        <div className="dl-idle">
                            <p className="dl-description">
                                This file is encrypted. Only you (and whoever has this link) can decrypt it.
                                The key never leaves your browser.
                            </p>
                            <button className="dl-primary-btn" onClick={() => startDownload()}>
                                <i className="bi bi-cloud-arrow-down" /> Download & Decrypt
                            </button>
                        </div>
                    )}

                    {stage === 'password' && (
                        <form className="dl-password-form" onSubmit={handlePasswordSubmit}>
                            <p className="dl-description"><i className="bi bi-lock-fill" /> This file is password protected.</p>
                            {errorMsg && <div className="dl-error">{errorMsg}</div>}
                            <input
                                className="upload-password-input"
                                type="password"
                                placeholder="Enter password…"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoFocus
                            />
                            <button className="dl-primary-btn" type="submit">
                                <i className="bi bi-unlock" /> Unlock & Download
                            </button>
                        </form>
                    )}

                    {(stage === 'downloading' || stage === 'decrypting') && (
                        <div className="dl-progress-area">
                            <div className="dl-progress-icon-wrap">
                                <i className={`bi ${stage === 'decrypting' ? 'bi-shield-shaded' : 'bi-cloud-download'} dl-progress-icon`} />
                            </div>
                            <p className="upload-phase-label">
                                {stage === 'decrypting' ? 'Decrypting…' : 'Downloading…'}
                            </p>
                            <div className="upload-progress-track">
                                <div className="upload-progress-fill" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="upload-progress-pct">{progress}%</span>
                        </div>
                    )}

                    {stage === 'preview' && (
                        <div className="dl-preview-area">
                            {/* Inline preview */}
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
                                    <button className="dl-primary-btn" onClick={() => triggerDownload(decryptedBlob!, fileName)}>
                                        <i className="bi bi-download" /> Save file
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {stage === 'error' && (
                        <div className="dl-error-area">
                            <i className="bi bi-exclamation-octagon dl-error-icon" />
                            <p className="dl-error-msg">{errorMsg}</p>
                            <button className="dl-secondary-btn" onClick={() => setStage('idle')}>
                                <i className="bi bi-arrow-counterclockwise" /> Try again
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
