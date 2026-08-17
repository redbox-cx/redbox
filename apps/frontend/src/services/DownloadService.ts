import {
    FILE_CHUNK_SIZE,
    FILE_ENCRYPTION_OVERHEAD,
    FILE_STREAM_FORMAT,
} from './FileCryptoFormat';

const MAX_PLAINTEXT_FILE_SIZE = 50 * 1024 * 1024 * 1024;
const MAX_FILE_CHUNKS = Math.ceil(MAX_PLAINTEXT_FILE_SIZE / FILE_CHUNK_SIZE);

export interface DownloadMetadata {
    fileName: string;
    mimeType: string;
    plaintextSize: number;
    encryptedSize: number;
    chunkSize: number;
    chunkCount: number;
    encryptionOverhead: number;
    format: string;
    passwordProtected: boolean;
}

export class DownloadApiError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'DownloadApiError';
        this.status = status;
    }
}

interface SaveFilePickerOptionsLike {
    suggestedName?: string;
}

type WindowWithSavePicker = Window & typeof globalThis & {
    showSaveFilePicker?: (options?: SaveFilePickerOptionsLike) => Promise<FileSystemFileHandle>;
};

function apiUrl(path: string) {
    const base = String(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
    return `${base}${path}`;
}

function downloadPath(fileId: string, token: string) {
    return `/files/download/${encodeURIComponent(fileId)}?token=${encodeURIComponent(token)}`;
}

function downloadMetadataPath(fileId: string, token: string) {
    return `/files/download/${encodeURIComponent(fileId)}/metadata?token=${encodeURIComponent(token)}`;
}

function requireSafeInteger(value: unknown, name: string, min: number, max: number) {
    if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
        throw new Error(`Invalid ${name} in download metadata.`);
    }
    return value as number;
}

function requireString(value: unknown, name: string, maxLength: number) {
    if (typeof value !== 'string' || value.length < 1 || value.length > maxLength) {
        throw new Error(`Invalid ${name} in download metadata.`);
    }
    return value;
}

export function sanitizeDownloadFileName(suggestedName: string) {
    return Array.from(suggestedName, character => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint <= 31 || codePoint === 127 ? '_' : character;
    })
        .join('')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/[. ]+$/g, '')
        .slice(0, 100) || 'download';
}

export function validateDownloadMetadata(value: unknown): DownloadMetadata {
    if (!value || typeof value !== 'object') {
        throw new Error('Download metadata is missing.');
    }

    const raw = value as Record<string, unknown>;
    const plaintextSize = requireSafeInteger(raw.plaintextSize, 'plaintext size', 1, MAX_PLAINTEXT_FILE_SIZE);
    const chunkSize = requireSafeInteger(raw.chunkSize, 'chunk size', 1, FILE_CHUNK_SIZE);
    const chunkCount = requireSafeInteger(raw.chunkCount, 'chunk count', 1, MAX_FILE_CHUNKS);
    const encryptionOverhead = requireSafeInteger(raw.encryptionOverhead, 'encryption overhead', 1, 1024);
    const encryptedSize = requireSafeInteger(
        raw.encryptedSize,
        'encrypted size',
        1,
        MAX_PLAINTEXT_FILE_SIZE + (MAX_FILE_CHUNKS * FILE_ENCRYPTION_OVERHEAD),
    );

    if (chunkSize !== FILE_CHUNK_SIZE || encryptionOverhead !== FILE_ENCRYPTION_OVERHEAD) {
        throw new Error('Unsupported encrypted file geometry.');
    }
    if (chunkCount !== Math.ceil(plaintextSize / chunkSize)) {
        throw new Error('Inconsistent encrypted chunk count.');
    }
    if (encryptedSize !== plaintextSize + (chunkCount * encryptionOverhead)) {
        throw new Error('Inconsistent encrypted file size.');
    }
    if (raw.format !== FILE_STREAM_FORMAT) {
        throw new Error('Unsupported encrypted file format.');
    }
    if (typeof raw.passwordProtected !== 'boolean') {
        throw new Error('Invalid password metadata.');
    }

    return {
        fileName: requireString(raw.fileName, 'filename', 100),
        mimeType: requireString(raw.mimeType, 'MIME type', 100),
        plaintextSize,
        encryptedSize,
        chunkSize,
        chunkCount,
        encryptionOverhead,
        format: raw.format,
        passwordProtected: raw.passwordProtected,
    };
}

function parseIntegerHeader(response: Response, name: string) {
    const raw = response.headers.get(name);
    if (!raw || !/^\d+$/.test(raw)) {
        throw new Error(`Missing or invalid ${name} response header.`);
    }
    const value = Number(raw);
    if (!Number.isSafeInteger(value)) {
        throw new Error(`Missing or invalid ${name} response header.`);
    }
    return value;
}

export function validateDownloadResponse(response: Response, metadata: DownloadMetadata) {
    const encryptedSize = parseIntegerHeader(response, 'content-length');
    const plaintextSize = parseIntegerHeader(response, 'x-redbox-plaintext-length');
    const chunkSize = parseIntegerHeader(response, 'x-redbox-chunk-size');
    const chunkCount = parseIntegerHeader(response, 'x-redbox-chunk-count');
    const encryptionOverhead = parseIntegerHeader(response, 'x-redbox-encryption-overhead');
    const format = response.headers.get('x-redbox-format');
    const encodedMimeType = response.headers.get('x-redbox-mime-type');

    let mimeType = '';
    try {
        mimeType = encodedMimeType ? decodeURIComponent(encodedMimeType) : '';
    } catch {
        throw new Error('Invalid MIME type response header.');
    }

    if (
        encryptedSize !== metadata.encryptedSize ||
        plaintextSize !== metadata.plaintextSize ||
        chunkSize !== metadata.chunkSize ||
        chunkCount !== metadata.chunkCount ||
        encryptionOverhead !== metadata.encryptionOverhead ||
        format !== metadata.format ||
        mimeType !== metadata.mimeType
    ) {
        throw new Error('Download response does not match the validated file metadata.');
    }
    if (response.headers.get('content-type')?.split(';', 1)[0].trim() !== 'application/octet-stream') {
        throw new Error('Unexpected encrypted download content type.');
    }
    if (!response.body) {
        throw new Error('The server returned an empty download stream.');
    }
}

async function readApiError(response: Response) {
    try {
        const payload = await response.json() as { message?: unknown };
        return typeof payload.message === 'string' ? payload.message : `Server error: ${response.status}`;
    } catch {
        return `Server error: ${response.status}`;
    }
}

export const DownloadService = {
    async getMetadata(
        fileId: string,
        token: string,
        options: { password?: string; signal?: AbortSignal } = {},
    ) {
        const hasPassword = options.password !== undefined;
        const response = await fetch(apiUrl(downloadMetadataPath(fileId, token)), {
            method: hasPassword ? 'POST' : 'GET',
            headers: hasPassword
                ? { Accept: 'application/json', 'Content-Type': 'application/json' }
                : { Accept: 'application/json' },
            body: hasPassword ? JSON.stringify({ password: options.password }) : undefined,
            signal: options.signal,
        });
        if (!response.ok) {
            throw new DownloadApiError(response.status, await readApiError(response));
        }

        const payload = await response.json() as { result?: unknown };
        return validateDownloadMetadata(payload.result);
    },

    fetchEncryptedFile(fileId: string, token: string, password: string | undefined, signal: AbortSignal) {
        const hasPassword = password !== undefined;
        return fetch(apiUrl(downloadPath(fileId, token)), {
            method: hasPassword ? 'POST' : 'GET',
            headers: hasPassword ? { 'Content-Type': 'application/json' } : undefined,
            body: hasPassword ? JSON.stringify({ password }) : undefined,
            signal,
        });
    },

    async getResponseError(response: Response) {
        return readApiError(response);
    },

    isPasswordRequired(error: unknown) {
        return error instanceof DownloadApiError && error.status === 403;
    },

    supportsNativeStreamingSave() {
        return typeof (window as WindowWithSavePicker).showSaveFilePicker === 'function';
    },

    pickSaveFile(suggestedName: string) {
        const pickerWindow = window as WindowWithSavePicker;
        if (!pickerWindow.showSaveFilePicker) {
            throw new Error('The native file picker became unavailable. Reload the page and retry.');
        }

        return pickerWindow.showSaveFilePicker({ suggestedName: sanitizeDownloadFileName(suggestedName) });
    },
};
