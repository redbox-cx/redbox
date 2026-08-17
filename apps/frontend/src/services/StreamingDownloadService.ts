import { CryptoService } from './CryptoService';
import type { DownloadMetadata } from './DownloadService';
import { createFileChunkAad } from './FileCryptoFormat';

type EncryptionMode = 'unknown' | 'authenticated-v2' | 'legacy-v1';

export interface SequentialWritable {
    write(data: Uint8Array<ArrayBuffer>): Promise<unknown> | unknown;
}

interface StreamDecryptParams {
    source: ReadableStream<Uint8Array>;
    writable: SequentialWritable;
    cryptoKey: CryptoKey;
    metadata: DownloadMetadata;
    signal: AbortSignal;
    onProgress?: (progress: number) => void;
}

function abortError() {
    return new DOMException('Download cancelled', 'AbortError');
}

function assertNotAborted(signal: AbortSignal) {
    if (signal.aborted) throw abortError();
}

function isAuthenticationFailure(error: unknown) {
    return error instanceof DOMException && error.name === 'OperationError';
}

async function decryptFrame(
    cryptoKey: CryptoKey,
    frame: Uint8Array<ArrayBuffer>,
    metadata: DownloadMetadata,
    chunkIndex: number,
    plaintextChunkLength: number,
    mode: EncryptionMode,
) {
    const aad = createFileChunkAad({
        fileSize: metadata.plaintextSize,
        chunkSize: metadata.chunkSize,
        totalChunks: metadata.chunkCount,
        chunkIndex,
        plaintextChunkLength,
    });

    if (mode === 'authenticated-v2') {
        return {
            plaintext: await CryptoService.decryptChunk(cryptoKey, frame, aad),
            mode,
        };
    }
    if (mode === 'legacy-v1') {
        return {
            plaintext: await CryptoService.decryptChunk(cryptoKey, frame),
            mode,
        };
    }

    try {
        return {
            plaintext: await CryptoService.decryptChunk(cryptoKey, frame, aad),
            mode: 'authenticated-v2' as const,
        };
    } catch (error) {
        if (!isAuthenticationFailure(error)) throw error;
        return {
            plaintext: await CryptoService.decryptChunk(cryptoKey, frame),
            mode: 'legacy-v1' as const,
        };
    }
}

export async function streamDecryptToFile({
    source,
    writable,
    cryptoKey,
    metadata,
    signal,
    onProgress,
}: StreamDecryptParams) {
    const reader = source.getReader();
    let networkChunk: Uint8Array | undefined;
    let networkOffset = 0;
    let receivedBytes = 0;
    let writtenBytes = 0;
    let encryptionMode: EncryptionMode = 'unknown';

    const readFrame = async (expectedLength: number) => {
        const frame = new Uint8Array(expectedLength);
        let frameOffset = 0;

        while (frameOffset < expectedLength) {
            assertNotAborted(signal);

            if (!networkChunk || networkOffset >= networkChunk.byteLength) {
                const next = await reader.read();
                if (next.done) {
                    throw new Error('Encrypted download ended before the expected file size.');
                }
                if (!next.value || next.value.byteLength === 0) continue;
                networkChunk = next.value;
                networkOffset = 0;
            }

            const bytesToCopy = Math.min(
                expectedLength - frameOffset,
                networkChunk.byteLength - networkOffset,
            );
            frame.set(networkChunk.subarray(networkOffset, networkOffset + bytesToCopy), frameOffset);
            networkOffset += bytesToCopy;
            frameOffset += bytesToCopy;
            receivedBytes += bytesToCopy;

            if (receivedBytes > metadata.encryptedSize) {
                throw new Error('Encrypted download is larger than expected.');
            }
        }

        if (networkChunk && networkOffset >= networkChunk.byteLength) {
            networkChunk = undefined;
            networkOffset = 0;
        }

        return frame;
    };

    try {
        for (let chunkIndex = 0; chunkIndex < metadata.chunkCount; chunkIndex += 1) {
            assertNotAborted(signal);

            const plaintextChunkLength = Math.min(
                metadata.chunkSize,
                metadata.plaintextSize - (chunkIndex * metadata.chunkSize),
            );
            const encryptedChunkLength = plaintextChunkLength + metadata.encryptionOverhead;
            let encryptedFrame: Uint8Array<ArrayBuffer> | null = await readFrame(encryptedChunkLength);
            const result = await decryptFrame(
                cryptoKey,
                encryptedFrame,
                metadata,
                chunkIndex,
                plaintextChunkLength,
                encryptionMode,
            );
            encryptedFrame = null;
            encryptionMode = result.mode;

            const plaintext = new Uint8Array(result.plaintext);
            if (plaintext.byteLength !== plaintextChunkLength) {
                throw new Error(`Decrypted chunk ${chunkIndex} has an invalid size.`);
            }

            assertNotAborted(signal);
            await writable.write(plaintext);
            writtenBytes += plaintext.byteLength;
            onProgress?.(Math.min(100, Math.round((writtenBytes / metadata.plaintextSize) * 100)));
        }

        if (networkChunk && networkOffset < networkChunk.byteLength) {
            throw new Error('Encrypted download contains trailing data.');
        }

        while (true) {
            assertNotAborted(signal);
            const finalRead = await reader.read();
            if (finalRead.done) break;
            if ((finalRead.value?.byteLength ?? 0) > 0) {
                throw new Error('Encrypted download contains trailing data.');
            }
        }
        if (receivedBytes !== metadata.encryptedSize) {
            throw new Error('Encrypted download size does not match metadata.');
        }
        if (writtenBytes !== metadata.plaintextSize) {
            throw new Error('Decrypted file size does not match metadata.');
        }
    } catch (error) {
        await reader.cancel(error).catch(() => {});
        throw error;
    } finally {
        reader.releaseLock();
    }
}
