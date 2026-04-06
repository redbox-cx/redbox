import { useEffect, useRef, useState, useCallback } from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { CryptoService } from '../services/CryptoService';
import { FileService, CHUNK_SIZE, type FileEntry } from '../services/FileService';

type UploadPhase = 'idle' | 'uploading' | 'finalizing' | 'done' | 'error';

const MAX_QUOTA = 2 * 1024 * 1024 * 1024;

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const s = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
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

export function Upload() {
    // Upload state
    const [file, setFile] = useState<File | null>(null);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [phase, setPhase] = useState<UploadPhase>('idle');
    const [progress, setProgress] = useState(0);
    const [currentChunk, setCurrentChunk] = useState(0);
    const [totalChunks, setTotalChunks] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // File list state
    const [fileList, setFileList] = useState<FileEntry[]>([]);
    const [totalUsed, setTotalUsed] = useState(0);
    const [loadingFiles, setLoadingFiles] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmEntry, setConfirmEntry] = useState<FileEntry | null>(null);

    useEffect(() => {
        document.documentElement.classList.add('dash-page');
        return () => { document.documentElement.classList.remove('dash-page'); };
    }, []);

    const [filesError, setFilesError] = useState('');

    const loadFiles = useCallback(async () => {
        try {
            const { files, totalUsed } = await FileService.getFiles();
            setFileList(files);
            setTotalUsed(totalUsed);
            setFilesError('');
        } catch (err: any) {
            const status = err?.response?.status;
            if (status === 401) {
                setFilesError('Session expired — please log out and log back in.');
            } else {
                setFilesError('Could not load files.');
            }
        } finally {
            setLoadingFiles(false);
        }
    }, []);

    useEffect(() => { loadFiles(); }, [loadFiles]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) setFile(dropped);
    };

    const handleUpload = async () => {
        if (!file) return;
        setPhase('uploading');
        setProgress(0);
        setErrorMsg('');

        try {
            const { cryptoKey, keyHex } = await CryptoService.generateKey();
            const chunks = Math.ceil(file.size / CHUNK_SIZE);
            setTotalChunks(chunks);

            const uploadId = await FileService.init(file.size, chunks, password || undefined);

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

            // Build share link with /d/ prefix
            const shareLink = `${window.location.origin}/d/${fileId}?token=${shareToken}#${keyHex}`;
            // Copy to clipboard automatically
            navigator.clipboard.writeText(shareLink).catch(() => {});

            setPhase('done');
            // Reload file list
            await loadFiles();
            // Reset after short delay
            setTimeout(() => {
                setFile(null);
                setPassword('');
                setShowPassword(false);
                setPhase('idle');
                setProgress(0);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }, 2500);
        } catch (err: any) {
            setErrorMsg(err?.response?.data?.message ?? err?.message ?? 'Upload failed');
            setPhase('error');
        }
    };

    const copyLink = (entry: FileEntry) => {
        const fullLink = `${window.location.origin}${entry.shareLink}`;
        navigator.clipboard.writeText(fullLink);
        setCopiedId(entry.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleDelete = async (entry: FileEntry) => {
        setConfirmEntry(entry);
    };

    const confirmDelete = async () => {
        if (!confirmEntry) return;
        const entry = confirmEntry;
        setConfirmEntry(null);
        setDeletingId(entry.id);
        try {
            await FileService.deleteFile(entry.id);
            await loadFiles();
        } catch {
            // ignore
        } finally {
            setDeletingId(null);
        }
    };

    const isUploading = phase === 'uploading' || phase === 'finalizing';
    const usedPct = Math.min((totalUsed / MAX_QUOTA) * 100, 100);

    return (
        <div className="dash-layout">
            {confirmEntry && (
                <div className="confirm-overlay" onClick={() => setConfirmEntry(null)}>
                    <div className="confirm-modal" onClick={e => e.stopPropagation()}>
                        <i className="bi bi-trash3 confirm-modal-icon" />
                        <p className="confirm-modal-title">Delete file?</p>
                        <p className="confirm-modal-desc">"{confirmEntry.originalName}" will be permanently deleted.</p>
                        <div className="confirm-modal-actions">
                            <button className="confirm-btn-cancel" onClick={() => setConfirmEntry(null)}>Cancel</button>
                            <button className="confirm-btn-delete" onClick={confirmDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="blob blob-1" />
            <div className="blob blob-2" />
            <TopBar />
            <main className="upload-drive-container">

                {/* ── Left: Upload panel ── */}
                <div className="upload-drive-left">
                    <div className="widget-tab"><i className="bi bi-cloud-arrow-up" /> Upload</div>
                    <div className="glass-panel upload-panel">

                        {/* Drop zone */}
                        <div
                            className={`upload-dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
                            onClick={() => !file && fileInputRef.current?.click()}
                            onDragOver={e => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={handleDrop}
                        >
                            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />

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
                                    <button className="upload-remove-btn" onClick={e => { e.stopPropagation(); setFile(null); setPhase('idle'); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                                        <i className="bi bi-x-lg" />
                                    </button>
                                </div>
                            ) : (
                                <div className="upload-dropzone-prompt">
                                    <i className="bi bi-cloud-arrow-up upload-cloud-icon" />
                                    <span className="upload-drop-label">Drop file or <span className="upload-browse-link">browse</span></span>
                                    <span className="upload-drop-hint">Max 2 GB · Encrypted in browser</span>
                                </div>
                            )}
                        </div>

                        {/* Password */}
                        {!isUploading && phase !== 'done' && (
                            <div className="upload-password-row">
                                <button className={`upload-password-toggle ${showPassword ? 'active' : ''}`} onClick={() => setShowPassword(v => !v)} type="button">
                                    <i className={`bi bi-lock${showPassword ? '-fill' : ''}`} />
                                    {showPassword ? 'Password on' : 'Add password'}
                                </button>
                                {showPassword && (
                                    <input className="upload-password-input" type="password" placeholder="Password…" value={password} onChange={e => setPassword(e.target.value)} maxLength={100} />
                                )}
                            </div>
                        )}

                        {phase === 'error' && (
                            <div className="upload-error"><i className="bi bi-exclamation-triangle" /> {errorMsg}</div>
                        )}

                        {!isUploading && phase !== 'done' && (
                            <button className="upload-submit-btn" disabled={!file} onClick={handleUpload}>
                                <i className="bi bi-shield-lock" /> Encrypt & Upload
                            </button>
                        )}

                        {/* Storage bar */}
                        <div className="upload-quota">
                            <div className="upload-quota-labels">
                                <span>{formatBytes(totalUsed)} used</span>
                                <span>{formatBytes(MAX_QUOTA)} total</span>
                            </div>
                            <div className="upload-quota-track">
                                <div className="upload-quota-fill" style={{ width: `${usedPct}%` }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Right: Files panel ── */}
                <div className="upload-drive-right">
                    <div className="widget-tab"><i className="bi bi-folder2-open" /> Your Files</div>
                    <div className="glass-panel upload-files-panel">
                        {loadingFiles ? (
                            <div className="empty-bins"><i className="bi bi-hourglass-split" /><span>Loading…</span></div>
                        ) : filesError ? (
                            <div className="empty-bins"><i className="bi bi-exclamation-triangle" /><span>{filesError}</span></div>
                        ) : fileList.length === 0 ? (
                            <div className="empty-bins"><i className="bi bi-cloud-slash" /><span>No files yet</span></div>
                        ) : (
                            <div className="drive-file-list">
                                {fileList.map(entry => (
                                    <div key={entry.id} className="drive-file-row">
                                        <i className={`bi ${getFileIcon(entry.mimetype)} drive-file-type-icon`} />
                                        <div className="drive-file-meta">
                                            <span className="drive-file-name">{entry.originalName}</span>
                                            <span className="drive-file-detail">
                                                {formatBytes(entry.size)} · Expires {formatDate(entry.expiresAt)}
                                            </span>
                                        </div>
                                        <div className="drive-file-actions">
                                            <button className={`drive-action-btn ${copiedId === entry.id ? 'copied' : ''}`} title="Copy share link" onClick={() => copyLink(entry)}>
                                                <i className={`bi bi-${copiedId === entry.id ? 'check-lg' : 'link-45deg'}`} />
                                            </button>
                                            <button className="drive-action-btn danger" title="Delete file" disabled={deletingId === entry.id} onClick={() => handleDelete(entry)}>
                                                <i className={`bi bi-${deletingId === entry.id ? 'hourglass-split' : 'trash3'}`} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </main>
        </div>
    );
}
