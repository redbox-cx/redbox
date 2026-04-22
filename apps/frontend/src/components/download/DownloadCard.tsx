import { useEffect, useRef, useState } from 'react';
import { CryptoService } from '../../services/CryptoService';
import { ENCRYPTED_CHUNK_SIZE } from '../../services/FileService';
import { ReportModal } from '../ReportModal';
import { DownloadCardHeader } from './DownloadCardHeader';
import { DownloadIdle } from './DownloadIdle';
import { DownloadPasswordForm } from './DownloadPasswordForm';
import { DownloadProgress } from './DownloadProgress';
import { DownloadPreview } from './DownloadPreview';
import { DownloadError } from './DownloadError';

type Stage = 'idle' | 'password' | 'downloading' | 'decrypting' | 'preview' | 'error';

interface Props {
    fileId: string;
    token: string;
    keyHex: string;
}

export function DownloadCard({ fileId, token, keyHex }: Props) {
    const [stage, setStage] = useState<Stage>('idle');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [progress, setProgress] = useState(0);
    const [fileName, setFileName] = useState('');
    const [mimeType, setMimeType] = useState('');
    const [fileSize, setFileSize] = useState(0);
    const [previewUrl, setPreviewUrl] = useState('');
    const [decryptedBlob, setDecryptedBlob] = useState<Blob | null>(null);
    const [reportOpen, setReportOpen] = useState(false);
    const [isPasswordProtected, setIsPasswordProtected] = useState(false);
    const downloadLinkRef = useRef<HTMLAnchorElement>(null);

    const buildUrl = () => `${import.meta.env.VITE_API_URL}/files/download/${fileId}?token=${token}`;

    const parseFileName = (contentDisposition: string | null): string => {
        if (!contentDisposition) return 'download';
        const rfc5987 = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (rfc5987) return decodeURIComponent(rfc5987[1].trim());
        const ascii = contentDisposition.match(/filename="([^"]+)"/);
        return ascii?.[1] ?? 'download';
    };

    const canPreview = (mime: string) =>
        mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/') || mime.includes('pdf');

    const triggerDownload = (blob: Blob, name: string) => {
        const url = URL.createObjectURL(blob);
        const a = downloadLinkRef.current!;
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
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
            const response = await fetch(buildUrl(), {
                method: pwd ? 'POST' : 'GET',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}`,
                    ...(pwd ? { 'Content-Type': 'application/json' } : {}),
                },
                body: pwd ? JSON.stringify({ password: pwd }) : undefined,
            });

            if (response.status === 403) {
                setIsPasswordProtected(true);
                setStage('password');
                if (pwd) setErrorMsg('Incorrect password. Try again.');
                return;
            }

            if (!response.ok) throw new Error(`Server error: ${response.status}`);

            const name = parseFileName(response.headers.get('content-disposition'));
            const mime = response.headers.get('content-type') ?? 'application/octet-stream';
            const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10);
            setFileName(name);
            setMimeType(mime);
            setFileSize(contentLength);

            const reader = response.body!.getReader();
            const chunks: Uint8Array[] = [];
            let received = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                received += value.length;
                if (contentLength > 0) setProgress(Math.round((received / contentLength) * 50));
            }

            const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
            const encryptedBuffer = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) { encryptedBuffer.set(chunk, offset); offset += chunk.length; }

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
                setProgress(50 + Math.round((pos / encryptedBuffer.byteLength) * 50));
            }

            const blob = new Blob(decryptedChunks as unknown as BlobPart[], { type: mime });
            setDecryptedBlob(blob);

            if (canPreview(mime)) {
                setPreviewUrl(URL.createObjectURL(blob));
            } else {
                triggerDownload(blob, name);
            }
            setStage('preview');
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : 'Download or decryption failed.');
            setStage('error');
        }
    };

    useEffect(() => {
        return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    }, [previewUrl]);

    return (
        <>
            <a ref={downloadLinkRef} style={{ display: 'none' }}>hidden</a>
            {reportOpen && (
                <ReportModal
                    onClose={() => setReportOpen(false)}
                    isPasswordProtected={isPasswordProtected}
                    showPasswordField
                    knownPassword={isPasswordProtected && stage !== 'password' && stage !== 'idle' ? password : undefined}
                />
            )}
            <div className="dl-card">
                <DownloadCardHeader
                    stage={stage}
                    fileName={fileName}
                    mimeType={mimeType}
                    fileSize={fileSize}
                    onReport={() => setReportOpen(true)}
                />
                {stage === 'idle' && <DownloadIdle onStart={() => startDownload()} />}
                {stage === 'password' && (
                    <DownloadPasswordForm
                        password={password}
                        errorMsg={errorMsg}
                        onChange={setPassword}
                        onSubmit={e => { e.preventDefault(); startDownload(password); }}
                    />
                )}
                {(stage === 'downloading' || stage === 'decrypting') && (
                    <DownloadProgress stage={stage} progress={progress} />
                )}
                {stage === 'preview' && (
                    <DownloadPreview
                        previewUrl={previewUrl}
                        mimeType={mimeType}
                        fileName={fileName}
                        decryptedBlob={decryptedBlob}
                        onSave={() => triggerDownload(decryptedBlob!, fileName)}
                    />
                )}
                {stage === 'error' && (
                    <DownloadError errorMsg={errorMsg} onRetry={() => setStage('idle')} />
                )}
            </div>
        </>
    );
}
