import { useRef, useState } from 'react';
import { CryptoService } from '../../services/CryptoService';
import { FileService, CHUNK_SIZE } from '../../services/FileService';
import { ExpiryDropdown } from '../bin/ExpiryDropdown';

type UploadPhase = 'idle' | 'uploading' | 'finalizing' | 'done' | 'error';

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const s = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
}

function getFileIcon(mime: string): string {
    if (mime.startsWith('image/')) return 'bi-file-image';
    if (mime.startsWith('video/')) return 'bi-file-play';
    if (mime.startsWith('audio/')) return 'bi-file-music';
    if (mime.includes('pdf')) return 'bi-file-pdf';
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z')) return 'bi-file-zip';
    if (mime.includes('text') || mime.includes('json') || mime.includes('xml')) return 'bi-file-code';
    return 'bi-file-earmark';
}

function getUploadErrorMessage(err: any): string {
    const status = err?.response?.status;
    const rawMessage = err?.response?.data?.message ?? err?.message;
    const message = Array.isArray(rawMessage)
        ? rawMessage.find(msg => typeof msg === 'string' && msg.includes('2GB')) ?? rawMessage[0]
        : rawMessage;

    if (status === 401 || message === 'Session expired') {
        return 'Session expired - please log out and log back in before uploading.';
    }

    return typeof message === 'string' ? message : 'Upload failed';
}

interface Props {
    totalUsed: number;
    quotaLimit: number;
    maxFileSize: number;
    onUploaded: () => void;
}

export function UploadFormPanel({ totalUsed, quotaLimit, maxFileSize, onUploaded }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [expiresIn, setExpiresIn] = useState('30d');
    const [dragging, setDragging] = useState(false);
    const [phase, setPhase] = useState<UploadPhase>('idle');
    const [progress, setProgress] = useState(0);
    const [currentChunk, setCurrentChunk] = useState(0);
    const [totalChunks, setTotalChunks] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isUploading = phase === 'uploading' || phase === 'finalizing';
    const usedPct = Math.min((totalUsed / quotaLimit) * 100, 100);
    const hasFileError = !!file && file.size > maxFileSize;

    const selectFile = (selected: File) => {
        setFile(selected);
        setProgress(0);
        setCurrentChunk(0);
        setTotalChunks(0);

        if (selected.size > maxFileSize) {
            setErrorMsg(`You can't upload more than ${formatBytes(maxFileSize)}`);
            setPhase('error');
            return;
        }

        setErrorMsg('');
        setPhase('idle');
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) selectFile(dropped);
    };

    const clearFile = () => {
        setFile(null);
        setPhase('idle');
        setErrorMsg('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleUpload = async () => {
        if (!file) return;
        if (file.size > maxFileSize) {
            setErrorMsg(`You can't upload more than ${formatBytes(maxFileSize)}`);
            setPhase('error');
            return;
        }

        setPhase('uploading');
        setProgress(0);
        setErrorMsg('');

        try {
            const { cryptoKey, keyHex } = await CryptoService.generateKey();
            const chunks = Math.ceil(file.size / CHUNK_SIZE);
            setTotalChunks(chunks);

            const uploadId = await FileService.init(file.size, chunks, password || undefined, expiresIn);

            for (let i = 0; i < chunks; i++) {
                setCurrentChunk(i + 1);
                const start = i * CHUNK_SIZE;
                const buf = await file.slice(start, Math.min(start + CHUNK_SIZE, file.size)).arrayBuffer();
                const encrypted = await CryptoService.encryptChunk(cryptoKey, buf);
                await FileService.uploadChunk(uploadId, i, encrypted);
                setProgress(Math.round(((i + 1) / chunks) * 100));
            }

            setPhase('finalizing');
            const { fileId, shareToken } = await FileService.complete({
                uploadId,
                fileName: file.name,
                totalChunks: chunks,
                mimetype: file.type || 'application/octet-stream',
                fileKey: keyHex,
            });

            const shareLink = `${window.location.origin}/d/${fileId}?token=${shareToken}#${keyHex}`;
            navigator.clipboard.writeText(shareLink).catch(() => {});

            setPhase('done');
            onUploaded();
            setTimeout(() => {
                clearFile();
                setPassword('');
                setShowPassword(false);
                setExpiresIn('30d');
                setProgress(0);
            }, 2500);
        } catch (err: any) {
            setErrorMsg(getUploadErrorMessage(err));
            setPhase('error');
        }
    };

    return (
        <div className="upload-drive-left">
            <div className="widget-tab"><i className="bi bi-cloud-arrow-up" /> Upload</div>
            <div className="glass-panel upload-panel">
                <div
                    className={`upload-dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
                    onClick={() => !file && fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                >
                    <input ref={fileInputRef} type="file" style={{ display: 'none' }}
                        onChange={e => e.target.files?.[0] && selectFile(e.target.files[0])} />

                    {isUploading || phase === 'done' ? (
                        <div className="upload-progress-inner">
                            {phase === 'done' ? (
                                <>
                                    <i className="bi bi-patch-check-fill upload-done-icon" />
                                    <span className="upload-phase-label">Link copied to clipboard!</span>
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-shield-shaded upload-spin-icon" />
                                    <span className="upload-phase-label">
                                        {phase === 'finalizing' ? 'Finalising…' : `Chunk ${currentChunk} / ${totalChunks}`}
                                    </span>
                                    <div className="upload-progress-track">
                                        <div className="upload-progress-fill" style={{ width: `${phase === 'finalizing' ? 99 : progress}%` }} />
                                    </div>
                                    <span className="upload-progress-pct">{phase === 'finalizing' ? 'Merging…' : `${progress}%`}</span>
                                </>
                            )}
                        </div>
                    ) : file ? (
                        <div className="upload-file-info">
                            <i className={`bi ${getFileIcon(file.type)} upload-file-icon`} />
                            <span className="upload-file-name">{file.name}</span>
                            <span className="upload-file-size">{formatBytes(file.size)}</span>
                            <button className="upload-remove-btn" onClick={e => { e.stopPropagation(); clearFile(); }}>
                                <i className="bi bi-x-lg" />
                            </button>
                        </div>
                    ) : (
                        <div className="upload-dropzone-prompt">
                            <i className="bi bi-cloud-arrow-up upload-cloud-icon" />
                            <span className="upload-drop-label">Drop file or <span className="upload-browse-link">browse</span></span>
                            <span className="upload-drop-hint">Max {formatBytes(maxFileSize)} · Encrypted in browser</span>
                        </div>
                    )}
                </div>

                {!isUploading && phase !== 'done' && (
                    <div className="upload-password-row">
                        <ExpiryDropdown
                            value={expiresIn}
                            onChange={setExpiresIn}
                            disabled={isUploading}
                            allowNever={false}
                        />
                        <button className={`upload-password-toggle ${showPassword ? 'active' : ''}`}
                            onClick={() => setShowPassword(v => !v)} type="button">
                            <i className={`bi bi-lock${showPassword ? '-fill' : ''}`} />
                            {showPassword ? 'Password on' : 'Add password'}
                        </button>
                        {showPassword && (
                            <input className="upload-password-input" type="password" placeholder="Password…"
                                value={password} onChange={e => setPassword(e.target.value)} maxLength={100} />
                        )}
                    </div>
                )}

                {phase === 'error' && (
                    <div className="upload-error"><i className="bi bi-exclamation-triangle" /> {errorMsg}</div>
                )}

                {!isUploading && phase !== 'done' && (
                    <button className="upload-submit-btn" disabled={!file || hasFileError} onClick={handleUpload}>
                        <i className="bi bi-shield-lock" /> Encrypt & Upload
                    </button>
                )}

                <div className="upload-quota">
                    <div className="upload-quota-labels">
                        <span>{formatBytes(totalUsed)} used</span>
                        <span>{formatBytes(quotaLimit)} total</span>
                    </div>
                    <div className="upload-quota-track">
                        <div className="upload-quota-fill" style={{ width: `${usedPct}%` }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
