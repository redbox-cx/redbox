import type { DownloadMetadata } from './DownloadService';
import type { SequentialWritable } from './StreamingDownloadService';

const PROTOCOL_VERSION = 1;
const WORKER_URL = '/__redbox_download/sw.js?v=1';
const WORKER_SCOPE = '/__redbox_download/';
const WORKER_ACTIVATION_TIMEOUT_MS = 15_000;
const WORKER_MESSAGE_TIMEOUT_MS = 10_000;
const WORKER_HEARTBEAT_INTERVAL_MS = 15_000;
const TRANSPORT_CHUNK_SIZE = 4 * 1024 * 1024;

type WorkerReply = {
    type?: unknown;
    version?: unknown;
    id?: unknown;
    message?: unknown;
};

export interface BrowserDownloadDestination {
    kind: 'browser-download';
    ready: Promise<void>;
    writable: SequentialWritable;
    close(): Promise<void>;
    abort(reason?: unknown): Promise<void>;
}

let preparedWorker: ServiceWorker | null = null;
let preparationPromise: Promise<ServiceWorker> | null = null;

function abortError() {
    return new DOMException('Download cancelled', 'AbortError');
}

function requireBrowserSupport() {
    if (!window.isSecureContext) {
        throw new Error('Secure streaming downloads require HTTPS (or localhost).');
    }
    if (!('serviceWorker' in navigator)) {
        throw new Error('Service workers are disabled or unavailable in this browser.');
    }
    if (
        typeof ReadableStream !== 'function' ||
        typeof WritableStream !== 'function' ||
        typeof TransformStream !== 'function' ||
        typeof MessageChannel !== 'function' ||
        typeof crypto?.getRandomValues !== 'function'
    ) {
        throw new Error('This browser does not support secure transferable download streams.');
    }
}

async function waitForActivatedWorker(registration: ServiceWorkerRegistration) {
    const deadline = Date.now() + WORKER_ACTIVATION_TIMEOUT_MS;

    while (Date.now() < deadline) {
        if (registration.active?.state === 'activated') {
            return registration.active;
        }
        await new Promise(resolve => window.setTimeout(resolve, 50));
    }

    throw new Error('The secure download service could not be activated.');
}

function workerMessageError(reply: WorkerReply) {
    return new Error(
        typeof reply.message === 'string' && reply.message.length > 0
            ? reply.message
            : 'The secure download service rejected the request.',
    );
}

async function probeTransferredStream(worker: ServiceWorker) {
    const channel = new MessageChannel();
    const probeStream = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(Uint8Array.of(0x52, 0x42));
            controller.close();
        },
    });

    let rejectReply!: (reason?: unknown) => void;
    let replyTimeout = 0;
    const reply = new Promise<void>((resolve, reject) => {
        rejectReply = reject;
        replyTimeout = window.setTimeout(() => {
            channel.port1.close();
            reject(new Error('The secure download service did not respond.'));
        }, WORKER_MESSAGE_TIMEOUT_MS);

        channel.port1.addEventListener('message', (event: MessageEvent<WorkerReply>) => {
            const message = event.data ?? {};
            window.clearTimeout(replyTimeout);
            channel.port1.close();

            if (
                message.type === 'REDBOX_DOWNLOAD_PROBE_OK' &&
                message.version === PROTOCOL_VERSION
            ) {
                resolve();
                return;
            }
            reject(workerMessageError(message));
        }, { once: true });
        channel.port1.addEventListener('messageerror', () => {
            window.clearTimeout(replyTimeout);
            channel.port1.close();
            reject(new Error('The secure download service returned an invalid response.'));
        }, { once: true });
        channel.port1.start();
    });

    try {
        worker.postMessage(
            {
                type: 'REDBOX_DOWNLOAD_PROBE',
                version: PROTOCOL_VERSION,
                readable: probeStream,
            },
            [probeStream as unknown as Transferable, channel.port2],
        );
    } catch (error) {
        window.clearTimeout(replyTimeout);
        channel.port1.close();
        channel.port2.close();
        rejectReply(error);
        await reply.catch(() => {});
        throw new Error(
            'This browser does not support secure transferable download streams.',
            { cause: error },
        );
    }

    await reply;
}

async function prepareWorker() {
    requireBrowserSupport();

    const registration = await navigator.serviceWorker.register(WORKER_URL, {
        scope: WORKER_SCOPE,
        updateViaCache: 'none',
    });
    const worker = await waitForActivatedWorker(registration);
    await probeTransferredStream(worker);

    if (worker.state !== 'activated') {
        throw new Error('The secure download service stopped unexpectedly.');
    }
    preparedWorker = worker;
    return worker;
}

function randomDownloadId() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function downloadUrl(id: string) {
    return `${WORKER_SCOPE}file/${id}`;
}

export const ServiceWorkerDownloadService = {
    async prepare() {
        if (preparedWorker?.state === 'activated') return;
        preparedWorker = null;
        if (!preparationPromise) {
            preparationPromise = prepareWorker();
        }
        const pendingPreparation = preparationPromise;
        try {
            await pendingPreparation;
        } finally {
            if (preparationPromise === pendingPreparation) {
                preparationPromise = null;
            }
        }
    },

    createDestination(
        metadata: DownloadMetadata,
        downloadController: AbortController,
    ): BrowserDownloadDestination {
        const { signal } = downloadController;
        const worker = preparedWorker;
        if (!worker || worker.state !== 'activated') {
            throw new Error('The secure download service is not ready. Please retry.');
        }
        if (signal.aborted) throw abortError();

        const id = randomDownloadId();
        const transform = new TransformStream<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>();
        const writer = transform.writable.getWriter();
        const channel = new MessageChannel();
        let terminal = false;
        let readySettled = false;
        let readyResolve!: () => void;
        let readyReject!: (reason?: unknown) => void;
        let startTimeout = 0;
        let heartbeatInterval = 0;

        const ready = new Promise<void>((resolve, reject) => {
            readyResolve = resolve;
            readyReject = reject;
        });

        const postControlMessage = (type: string) => {
            if (worker.state === 'redundant') return;
            try {
                worker.postMessage({ type, version: PROTOCOL_VERSION, id });
            } catch {
                // Stream errors still propagate through writer.closed.
            }
        };

        const stopHeartbeat = () => {
            window.clearInterval(heartbeatInterval);
            heartbeatInterval = 0;
        };

        const startHeartbeat = () => {
            if (heartbeatInterval || terminal) return;
            postControlMessage('REDBOX_DOWNLOAD_HEARTBEAT');
            heartbeatInterval = window.setInterval(() => {
                postControlMessage('REDBOX_DOWNLOAD_HEARTBEAT');
            }, WORKER_HEARTBEAT_INTERVAL_MS);
        };

        const settleReady = (error?: unknown) => {
            if (readySettled) return;
            readySettled = true;
            window.clearTimeout(startTimeout);
            worker.removeEventListener('statechange', handleWorkerStateChange);
            channel.port1.close();
            if (error === undefined) {
                startHeartbeat();
                readyResolve();
            } else {
                readyReject(error);
            }
        };

        const handleWorkerStateChange = () => {
            if (worker.state !== 'activated') {
                settleReady(new Error('The secure download service stopped unexpectedly.'));
            }
        };

        const cancelWorkerSession = () => {
            postControlMessage('REDBOX_DOWNLOAD_CANCEL');
        };

        startTimeout = window.setTimeout(() => {
            settleReady(new Error('The browser did not start the secure download.'));
            cancelWorkerSession();
            void writer.abort(new Error('Download start timed out')).catch(() => {});
        }, WORKER_MESSAGE_TIMEOUT_MS);

        channel.port1.addEventListener('message', (event: MessageEvent<WorkerReply>) => {
            const message = event.data ?? {};
            if (
                message.type === 'REDBOX_DOWNLOAD_STARTED' &&
                message.version === PROTOCOL_VERSION &&
                message.id === id
            ) {
                settleReady();
                return;
            }
            if (message.type === 'REDBOX_DOWNLOAD_ERROR' && message.id === id) {
                settleReady(workerMessageError(message));
            }
        });
        channel.port1.addEventListener('messageerror', () => {
            settleReady(new Error('The secure download service returned an invalid response.'));
        }, { once: true });
        channel.port1.start();
        worker.addEventListener('statechange', handleWorkerStateChange);

        const onAbort = () => {
            if (terminal) return;
            terminal = true;
            stopHeartbeat();
            const reason = signal.reason ?? abortError();
            settleReady(reason);
            cancelWorkerSession();
            void writer.abort(reason).catch(() => {});
        };
        signal.addEventListener('abort', onAbort, { once: true });
        void writer.closed.catch(error => {
            if (!terminal && !signal.aborted) {
                downloadController.abort(error);
            }
        });

        const destination: BrowserDownloadDestination = {
            kind: 'browser-download',
            ready,
            writable: {
                async write(data) {
                    await ready;
                    if (terminal || signal.aborted) throw abortError();

                    for (let offset = 0; offset < data.byteLength; offset += TRANSPORT_CHUNK_SIZE) {
                        if (terminal || signal.aborted) throw abortError();
                        const transportChunk = data.slice(
                            offset,
                            Math.min(offset + TRANSPORT_CHUNK_SIZE, data.byteLength),
                        );
                        await writer.write(transportChunk);
                    }
                },
            },
            async close() {
                if (terminal) return;
                await ready;
                await writer.close();
                postControlMessage('REDBOX_DOWNLOAD_COMPLETE');
                stopHeartbeat();
                terminal = true;
                signal.removeEventListener('abort', onAbort);
            },
            async abort(reason?: unknown) {
                if (terminal) return;
                terminal = true;
                stopHeartbeat();
                settleReady(reason ?? abortError());
                signal.removeEventListener('abort', onAbort);
                cancelWorkerSession();
                await writer.abort(reason).catch(() => {});
            },
        };

        try {
            worker.postMessage(
                {
                    type: 'REDBOX_STREAM_DOWNLOAD',
                    version: PROTOCOL_VERSION,
                    id,
                    fileName: metadata.fileName,
                    size: metadata.plaintextSize,
                    readable: transform.readable,
                },
                [transform.readable as unknown as Transferable, channel.port2],
            );

            const anchor = document.createElement('a');
            anchor.href = downloadUrl(id);
            anchor.rel = 'noopener';
            anchor.hidden = true;
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
        } catch (error) {
            void ready.catch(() => {});
            void destination.abort(error);
            throw new Error('Could not start the secure browser download.', { cause: error });
        }

        return destination;
    },
};
