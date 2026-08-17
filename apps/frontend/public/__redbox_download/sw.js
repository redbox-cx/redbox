'use strict';

const PROTOCOL_VERSION = 1;
const MAX_PLAINTEXT_SIZE = 50 * 1024 * 1024 * 1024;
const SESSION_TTL_MS = 30_000;
const FETCH_WAIT_MS = 10_000;
const ACTIVE_SESSION_TTL_MS = 5 * 60_000;
const COMPLETE_GRACE_MS = 5_000;
const MAX_PENDING_SESSIONS = 4;
const MAX_PENDING_FETCHES = 8;
const MAX_ACTIVE_DOWNLOADS = 4;
const DOWNLOAD_PATH_PATTERN = /^\/__redbox_download\/file\/([0-9a-f]{64})$/;

const sessions = new Map();
const fetchWaiters = new Map();
const activeDownloads = new Map();

function isReadableStream(value) {
    return value !== null && typeof value === 'object' && typeof value.getReader === 'function';
}

function postReply(port, message) {
    try {
        port.postMessage(message);
    } catch {
        // The page may have navigated away. Stream cancellation still releases
        // the download resources in that case.
    }
}

function closePort(port) {
    try {
        port.close();
    } catch {
        // Closing an already detached port is harmless.
    }
}

async function cancelReadable(readable, reason) {
    try {
        await readable.cancel(reason);
    } catch {
        // An already errored or consumed stream needs no further cleanup.
    }
}

function makeLifetime() {
    let resolve;
    const promise = new Promise(done => {
        resolve = done;
    });
    return { promise, resolve };
}

function sourceId(event) {
    return event.source && typeof event.source.id === 'string' ? event.source.id : null;
}

function releaseActiveDownload(id, entry) {
    if (activeDownloads.get(id) !== entry) return;
    clearTimeout(entry.timeout);
    activeDownloads.delete(id);
    entry.releaseLifetime();
}

function refreshActiveDownload(id, entry, delay = ACTIVE_SESSION_TTL_MS) {
    clearTimeout(entry.timeout);
    entry.timeout = setTimeout(() => releaseActiveDownload(id, entry), delay);
}

function expireSession(session, message) {
    if (session.claimed) return;
    session.claimed = true;
    if (session.timeout !== undefined) clearTimeout(session.timeout);
    sessions.delete(session.id);
    postReply(session.port, {
        type: 'REDBOX_DOWNLOAD_ERROR',
        version: PROTOCOL_VERSION,
        id: session.id,
        message,
    });
    closePort(session.port);
    session.releaseLifetime();
    void cancelReadable(session.readable, new Error(message));
}

function sanitizeFileName(fileName) {
    let safe = '';

    for (const character of Array.from(fileName)) {
        const codePoint = character.codePointAt(0) ?? 0;
        const invalid =
            codePoint <= 31 ||
            codePoint === 127 ||
            (codePoint >= 0xd800 && codePoint <= 0xdfff) ||
            (codePoint >= 0x202a && codePoint <= 0x202e) ||
            (codePoint >= 0x2066 && codePoint <= 0x2069) ||
            /[\\/:*?"<>|]/.test(character);
        safe += invalid ? '_' : character;
    }

    safe = safe.replace(/[. ]+$/g, '').slice(0, 100) || 'download';
    return safe;
}

function contentDisposition(fileName) {
    const safeName = sanitizeFileName(fileName);
    const asciiName = Array.from(safeName, character => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint >= 0x20 && codePoint <= 0x7e && !/["\\;]/.test(character)
            ? character
            : '_';
    }).join('') || 'download';
    const encodedName = encodeURIComponent(safeName)
        .replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

    return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}

function goneResponse() {
    return new Response('Download session expired or was already used.', {
        status: 410,
        headers: {
            'Cache-Control': 'no-store',
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}

function claimSession(session) {
    if (!session || session.claimed) return goneResponse();
    if (activeDownloads.size >= MAX_ACTIVE_DOWNLOADS) {
        expireSession(session, 'Too many secure downloads are active.');
        return goneResponse();
    }

    session.claimed = true;
    if (session.timeout !== undefined) clearTimeout(session.timeout);
    sessions.delete(session.id);
    const activeEntry = {
        sourceId: session.sourceId,
        releaseLifetime: session.releaseLifetime,
        timeout: undefined,
    };
    activeDownloads.set(session.id, activeEntry);
    refreshActiveDownload(session.id, activeEntry);
    postReply(session.port, {
        type: 'REDBOX_DOWNLOAD_STARTED',
        version: PROTOCOL_VERSION,
        id: session.id,
    });
    closePort(session.port);

    return new Response(session.readable, {
        status: 200,
        headers: {
            'Accept-Ranges': 'none',
            'Cache-Control': 'private, no-store, no-transform',
            'Content-Disposition': contentDisposition(session.fileName),
            'Content-Length': String(session.size),
            'Content-Security-Policy': "default-src 'none'",
            'Content-Type': 'application/octet-stream',
            'Cross-Origin-Resource-Policy': 'same-origin',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}

function waitForSession(id) {
    if (fetchWaiters.has(id) || fetchWaiters.size >= MAX_PENDING_FETCHES) {
        return Promise.resolve(null);
    }

    return new Promise(resolve => {
        const timeout = setTimeout(() => {
            fetchWaiters.delete(id);
            resolve(null);
        }, FETCH_WAIT_MS);
        fetchWaiters.set(id, { resolve, timeout });
    });
}

function offerSession(session) {
    if (activeDownloads.size >= MAX_ACTIVE_DOWNLOADS) {
        return false;
    }
    const waiter = fetchWaiters.get(session.id);
    if (waiter) {
        fetchWaiters.delete(session.id);
        clearTimeout(waiter.timeout);
        waiter.resolve(session);
        return true;
    }

    if (sessions.has(session.id) || sessions.size >= MAX_PENDING_SESSIONS) {
        return false;
    }

    session.timeout = setTimeout(() => {
        expireSession(session, 'The secure download was not claimed in time.');
    }, SESSION_TTL_MS);
    sessions.set(session.id, session);
    return true;
}

async function handleProbe(data, port) {
    if (data.version !== PROTOCOL_VERSION || !isReadableStream(data.readable)) {
        if (isReadableStream(data.readable)) {
            await cancelReadable(data.readable, new Error('Invalid secure download probe.'));
        }
        postReply(port, {
            type: 'REDBOX_DOWNLOAD_ERROR',
            version: PROTOCOL_VERSION,
            message: 'Unsupported secure download protocol.',
        });
        closePort(port);
        return;
    }

    const reader = data.readable.getReader();
    try {
        const first = await reader.read();
        const end = await reader.read();
        const bytes = first.value;
        if (
            first.done ||
            !(bytes instanceof Uint8Array) ||
            bytes.byteLength !== 2 ||
            bytes[0] !== 0x52 ||
            bytes[1] !== 0x42 ||
            !end.done
        ) {
            throw new Error('Transferred stream probe failed.');
        }
        postReply(port, {
            type: 'REDBOX_DOWNLOAD_PROBE_OK',
            version: PROTOCOL_VERSION,
        });
    } catch {
        postReply(port, {
            type: 'REDBOX_DOWNLOAD_ERROR',
            version: PROTOCOL_VERSION,
            message: 'This browser cannot transfer secure download streams.',
        });
        await reader.cancel().catch(() => {});
    } finally {
        reader.releaseLock();
        closePort(port);
    }
}

self.addEventListener('message', event => {
    const data = event.data;
    const port = event.ports[0];
    if (!data || typeof data !== 'object') return;

    if (data.type === 'REDBOX_DOWNLOAD_PROBE') {
        if (!port) return;
        event.waitUntil(handleProbe(data, port));
        return;
    }

    if (
        data.type === 'REDBOX_DOWNLOAD_HEARTBEAT' ||
        data.type === 'REDBOX_DOWNLOAD_COMPLETE' ||
        data.type === 'REDBOX_DOWNLOAD_CANCEL'
    ) {
        if (
            data.version !== PROTOCOL_VERSION ||
            typeof data.id !== 'string' ||
            !/^[0-9a-f]{64}$/.test(data.id)
        ) return;

        const activeEntry = activeDownloads.get(data.id);
        if (activeEntry && activeEntry.sourceId === sourceId(event)) {
            if (data.type === 'REDBOX_DOWNLOAD_HEARTBEAT') {
                refreshActiveDownload(data.id, activeEntry);
                event.waitUntil(Promise.resolve());
            } else if (data.type === 'REDBOX_DOWNLOAD_COMPLETE') {
                refreshActiveDownload(data.id, activeEntry, COMPLETE_GRACE_MS);
            } else {
                releaseActiveDownload(data.id, activeEntry);
            }
            return;
        }

        if (data.type !== 'REDBOX_DOWNLOAD_CANCEL') return;
        const session = sessions.get(data.id);
        if (session && session.sourceId === sourceId(event)) {
            expireSession(session, 'Download cancelled.');
            return;
        }
        const waiter = fetchWaiters.get(data.id);
        if (waiter) {
            fetchWaiters.delete(data.id);
            clearTimeout(waiter.timeout);
            waiter.resolve(null);
        }
        return;
    }

    if (data.type !== 'REDBOX_STREAM_DOWNLOAD' || !port) return;

    const valid =
        data.version === PROTOCOL_VERSION &&
        typeof data.id === 'string' &&
        /^[0-9a-f]{64}$/.test(data.id) &&
        typeof data.fileName === 'string' &&
        data.fileName.length >= 1 &&
        data.fileName.length <= 100 &&
        Number.isSafeInteger(data.size) &&
        data.size >= 1 &&
        data.size <= MAX_PLAINTEXT_SIZE &&
        isReadableStream(data.readable) &&
        sourceId(event) !== null;

    if (!valid) {
        if (isReadableStream(data.readable)) {
            event.waitUntil(cancelReadable(data.readable, new Error('Invalid download session.')));
        }
        postReply(port, {
            type: 'REDBOX_DOWNLOAD_ERROR',
            version: PROTOCOL_VERSION,
            id: typeof data.id === 'string' ? data.id : '',
            message: 'Invalid secure download session.',
        });
        closePort(port);
        return;
    }

    const lifetime = makeLifetime();
    const session = {
        id: data.id,
        fileName: data.fileName,
        size: data.size,
        readable: data.readable,
        port,
        sourceId: sourceId(event),
        claimed: false,
        timeout: undefined,
        releaseLifetime: lifetime.resolve,
    };

    if (!offerSession(session)) {
        expireSession(session, 'Too many secure downloads are waiting to start.');
    }
    event.waitUntil(lifetime.promise);
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    const match = DOWNLOAD_PATH_PATTERN.exec(url.pathname);
    if (!match || url.origin !== self.location.origin || url.search) return;

    if (event.request.method !== 'GET' || event.request.headers.has('range')) {
        event.respondWith(new Response(null, {
            status: event.request.headers.has('range') ? 416 : 405,
            headers: {
                'Accept-Ranges': 'none',
                'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff',
            },
        }));
        return;
    }

    const id = match[1];
    const existing = sessions.get(id);
    if (existing) {
        sessions.delete(id);
        event.respondWith(Promise.resolve(claimSession(existing)));
        return;
    }

    event.respondWith(
        waitForSession(id).then(session => session ? claimSession(session) : goneResponse()),
    );
});
