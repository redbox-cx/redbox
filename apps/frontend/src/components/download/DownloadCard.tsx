import { useEffect, useRef, useState } from 'react';
import { CryptoService } from '../../services/CryptoService';
import { DownloadService, validateDownloadResponse, type DownloadMetadata } from '../../services/DownloadService';
import { ServiceWorkerDownloadService } from '../../services/ServiceWorkerDownloadService';
import { streamDecryptToFile, type SequentialWritable } from '../../services/StreamingDownloadService';
import { ReportModal } from '../ReportModal';
import { DownloadCardHeader } from './DownloadCardHeader';
import { DownloadIdle } from './DownloadIdle';
import { DownloadPasswordForm } from './DownloadPasswordForm';
import { DownloadProgress } from './DownloadProgress';
import { DownloadComplete } from './DownloadComplete';
import { DownloadError } from './DownloadError';

type Stage = 'idle' | 'password' | 'downloading' | 'finalizing' | 'complete' | 'error';
type SaveMethod = 'checking' | 'file-system' | 'browser-download' | 'unavailable';

interface DownloadDestination {
    kind: 'file-system' | 'browser-download';
    ready: Promise<void>;
    writable: SequentialWritable;
    close(): Promise<void>;
    abort(reason?: unknown): Promise<void>;
}

interface Props {
    fileId: string;
    token: string;
    keyHex: string;
}

function isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === 'AbortError';
}

export function DownloadCard({ fileId, token, keyHex }: Props) {
    const [stage, setStage] = useState<Stage>('idle');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [progress, setProgress] = useState<number | null>(0);
    const [metadata, setMetadata] = useState<DownloadMetadata | null>(null);
    const [metadataRequestVersion, setMetadataRequestVersion] = useState(0);
    const [unlocking, setUnlocking] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
    const [saveMethod, setSaveMethod] = useState<SaveMethod>('checking');
    const [saveMethodError, setSaveMethodError] = useState('');
    const [completedWithBrowserDownload, setCompletedWithBrowserDownload] = useState(false);
    const activeDownloadRef = useRef<AbortController | null>(null);
    const activeDestinationRef = useRef<DownloadDestination | null>(null);
    const activeUnlockRef = useRef<AbortController | null>(null);
    const downloadStartingRef = useRef(false);
    const downloadCancelableRef = useRef(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        let current = true;

        if (DownloadService.supportsNativeStreamingSave()) {
            setSaveMethod('file-system');
            return () => {
                current = false;
            };
        }

        setSaveMethod('checking');
        ServiceWorkerDownloadService.prepare()
            .then(() => {
                if (!current) return;
                setSaveMethodError('');
                setSaveMethod('browser-download');
            })
            .catch((error: unknown) => {
                if (!current) return;
                setSaveMethodError(
                    error instanceof Error
                        ? error.message
                        : 'Secure streaming downloads are unavailable in this browser.',
                );
                setSaveMethod('unavailable');
            });

        return () => {
            current = false;
        };
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        setMetadata(null);
        setErrorMsg('');
        setStage('idle');

        DownloadService.getMetadata(fileId, token, { signal: controller.signal })
            .then(result => {
                setMetadata(result);
                setStage('idle');
            })
            .catch((error: unknown) => {
                if (isAbortError(error)) return;
                if (DownloadService.isPasswordRequired(error)) {
                    setStage('password');
                    return;
                }
                setErrorMsg(error instanceof Error ? error.message : 'Could not load file metadata.');
                setStage('error');
            });

        return () => controller.abort();
    }, [fileId, token, metadataRequestVersion]);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            activeDownloadRef.current?.abort();
            void activeDestinationRef.current?.abort(new DOMException('Download cancelled', 'AbortError'));
            activeUnlockRef.current?.abort();
        };
    }, []);

    const resetStage = () => {
        setErrorMsg('');
        setProgress(0);
        if (!metadata) {
            setMetadataRequestVersion(version => version + 1);
            return;
        }
        setStage('idle');
    };

    const unlockMetadata = async (providedPassword: string) => {
        if (providedPassword.length < 1 || providedPassword.length > 100) {
            setErrorMsg('Password must have between 1 and 100 characters.');
            return;
        }
        if (activeUnlockRef.current) return;

        const controller = new AbortController();
        activeUnlockRef.current = controller;
        setUnlocking(true);
        setErrorMsg('');

        try {
            const result = await DownloadService.getMetadata(fileId, token, {
                password: providedPassword,
                signal: controller.signal,
            });
            if (controller.signal.aborted || !mountedRef.current) return;
            setMetadata(result);
            setStage('idle');
        } catch (error: unknown) {
            if (isAbortError(error) || controller.signal.aborted || !mountedRef.current) return;
            setErrorMsg(
                DownloadService.isPasswordRequired(error)
                    ? 'Incorrect password. Try again.'
                    : error instanceof Error ? error.message : 'Could not unlock file metadata.',
            );
        } finally {
            if (activeUnlockRef.current === controller) {
                activeUnlockRef.current = null;
                if (mountedRef.current) setUnlocking(false);
            }
        }
    };

    const startDownload = async (providedPassword?: string) => {
        if (!metadata) {
            setErrorMsg('File metadata is still loading.');
            setStage('error');
            return;
        }
        if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
            setErrorMsg('Invalid or missing decryption key in the URL fragment.');
            setStage('error');
            return;
        }
        if (
            metadata.passwordProtected &&
            (providedPassword === undefined || providedPassword.length < 1 || providedPassword.length > 100)
        ) {
            setErrorMsg('Password must have between 1 and 100 characters.');
            setStage('password');
            return;
        }
        if (saveMethod === 'checking') {
            setErrorMsg('The secure download service is still starting. Please retry in a moment.');
            setStage('error');
            return;
        }
        if (saveMethod === 'unavailable') {
            setErrorMsg(saveMethodError || 'Secure streaming downloads are unavailable in this browser.');
            setStage('error');
            return;
        }
        if (downloadStartingRef.current || activeDownloadRef.current) return;
        downloadStartingRef.current = true;

        let controller: AbortController | null = null;
        let fileHandle: FileSystemFileHandle | null = null;
        let destination: DownloadDestination | null = null;
        let response: Response | null = null;

        try {
            if (saveMethod === 'file-system') {
                // Must be called directly from the user's click/submit event before
                // network awaits, otherwise browsers reject the save picker.
                fileHandle = await DownloadService.pickSaveFile(metadata.fileName);
                if (!mountedRef.current) return;
            }

            controller = new AbortController();
            activeDownloadRef.current = controller;

            if (saveMethod === 'browser-download') {
                // This posts the stream and clicks the same-origin download URL
                // synchronously while the user's click is still active.
                destination = ServiceWorkerDownloadService.createDestination(metadata, controller);
                activeDestinationRef.current = destination;
            }

            downloadCancelableRef.current = true;
            setStage('downloading');
            setProgress(0);
            setErrorMsg('');

            if (destination?.kind === 'browser-download') {
                await destination.ready;
            }

            response = await DownloadService.fetchEncryptedFile(
                fileId,
                token,
                providedPassword,
                controller.signal,
            );

            if (response.status === 403) {
                await response.body?.cancel().catch(() => {});
                await destination?.abort(new Error('Download authorization failed.'));
                setMetadata(null);
                setStage('password');
                setErrorMsg(providedPassword ? 'Incorrect password. Try again.' : 'This file is password protected.');
                return;
            }
            if (!response.ok) {
                throw new Error(await DownloadService.getResponseError(response));
            }

            validateDownloadResponse(response, metadata);
            const cryptoKey = await CryptoService.importKey(keyHex);

            if (saveMethod === 'file-system') {
                if (!fileHandle) throw new Error('No save location was selected.');
                const writable = await fileHandle.createWritable();
                destination = {
                    kind: 'file-system',
                    ready: Promise.resolve(),
                    writable,
                    close: () => writable.close(),
                    abort: reason => writable.abort(reason),
                };
                activeDestinationRef.current = destination;
            }
            if (!destination) throw new Error('No secure download destination is available.');

            await streamDecryptToFile({
                source: response.body!,
                writable: destination.writable,
                cryptoKey,
                metadata,
                signal: controller.signal,
                onProgress: setProgress,
            });

            downloadCancelableRef.current = false;
            setStage('finalizing');
            if (controller.signal.aborted) {
                throw new DOMException('Download cancelled', 'AbortError');
            }
            const browserManagedDownload = destination.kind === 'browser-download';
            await destination.close();
            if (!mountedRef.current) return;
            setCompletedWithBrowserDownload(browserManagedDownload);
            setProgress(100);
            setStage('complete');
        } catch (error: unknown) {
            await response?.body?.cancel(error).catch(() => {});
            await destination?.abort(error).catch(() => {});

            if (!mountedRef.current) return;
            if (!controller && isAbortError(error)) return;
            const abortReason = controller?.signal.aborted ? controller.signal.reason : undefined;
            if (
                (controller?.signal.aborted && (abortReason === undefined || isAbortError(abortReason))) ||
                (!controller?.signal.aborted && isAbortError(error))
            ) {
                setErrorMsg('Download cancelled.');
            } else if (controller?.signal.aborted && abortReason instanceof Error) {
                setErrorMsg(`The browser download failed: ${abortReason.message}`);
            } else if (error instanceof DOMException && error.name === 'OperationError') {
                setErrorMsg('The decryption key is wrong or the encrypted file is corrupted.');
            } else {
                setErrorMsg(error instanceof Error ? error.message : 'Download or decryption failed.');
            }
            setStage('error');
        } finally {
            downloadStartingRef.current = false;
            downloadCancelableRef.current = false;
            if (controller && activeDownloadRef.current === controller) {
                activeDownloadRef.current = null;
            }
            if (destination && activeDestinationRef.current === destination) {
                activeDestinationRef.current = null;
            }
        }
    };

    return (
        <>
            {reportOpen && (
                <ReportModal
                    onClose={() => setReportOpen(false)}
                    isPasswordProtected={metadata?.passwordProtected ?? false}
                    showPasswordField
                    knownPassword={metadata?.passwordProtected && stage === 'complete' ? password : undefined}
                />
            )}
            <div className="dl-card">
                <DownloadCardHeader
                    stage={stage}
                    fileName={metadata?.fileName ?? ''}
                    mimeType={metadata?.mimeType ?? ''}
                    fileSize={metadata?.plaintextSize ?? 0}
                    onReport={() => setReportOpen(true)}
                />
                {stage === 'idle' && (
                    <DownloadIdle
                        onStart={() => startDownload(metadata?.passwordProtected ? password : undefined)}
                        disabled={!metadata || saveMethod === 'checking' || saveMethod === 'unavailable'}
                        disabledLabel={
                            !metadata
                                ? 'Loading file...'
                                : saveMethod === 'checking'
                                    ? 'Preparing secure download...'
                                    : saveMethod === 'unavailable'
                                        ? 'Secure streaming unavailable'
                                        : undefined
                        }
                        notice={saveMethod === 'unavailable' ? saveMethodError : undefined}
                    />
                )}
                {stage === 'password' && (
                    <DownloadPasswordForm
                        password={password}
                        errorMsg={errorMsg}
                        disabled={unlocking}
                        onChange={setPassword}
                        onSubmit={event => {
                            event.preventDefault();
                            unlockMetadata(password);
                        }}
                    />
                )}
                {(stage === 'downloading' || stage === 'finalizing') && (
                    <DownloadProgress
                        stage={stage}
                        progress={progress}
                        onCancel={stage === 'downloading'
                            ? () => {
                                if (downloadCancelableRef.current) activeDownloadRef.current?.abort();
                            }
                            : undefined}
                    />
                )}
                {stage === 'complete' && metadata && (
                    <DownloadComplete
                        fileName={metadata.fileName}
                        browserManaged={completedWithBrowserDownload}
                        onDownloadAnotherCopy={resetStage}
                    />
                )}
                {stage === 'error' && (
                    <DownloadError errorMsg={errorMsg} onRetry={resetStage} />
                )}
            </div>
        </>
    );
}
