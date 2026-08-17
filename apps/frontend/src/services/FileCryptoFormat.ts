export const FILE_CHUNK_SIZE = 50 * 1024 * 1024;
export const FILE_IV_LENGTH = 12;
export const FILE_GCM_TAG_LENGTH = 16;
export const FILE_ENCRYPTION_OVERHEAD = FILE_IV_LENGTH + FILE_GCM_TAG_LENGTH;
export const FILE_STREAM_FORMAT = 'aes-gcm-chunked-v1-or-aad-v2';

const AAD_MAGIC = new TextEncoder().encode('redbox-file-v2');

interface FileChunkAadParams {
    fileSize: number;
    chunkSize: number;
    totalChunks: number;
    chunkIndex: number;
    plaintextChunkLength: number;
}

/**
 * Authenticates a chunk's position and file geometry for new uploads.
 * Legacy files did not use AAD; the streaming decoder detects them once on
 * the first chunk and then keeps the detected mode for the entire file.
 */
export function createFileChunkAad(params: FileChunkAadParams): Uint8Array<ArrayBuffer> {
    const buffer = new ArrayBuffer(AAD_MAGIC.byteLength + 8 + (4 * 4));
    const bytes = new Uint8Array(buffer);
    bytes.set(AAD_MAGIC, 0);

    const view = new DataView(buffer);
    let offset = AAD_MAGIC.byteLength;
    view.setBigUint64(offset, BigInt(params.fileSize));
    offset += 8;
    view.setUint32(offset, params.chunkSize);
    offset += 4;
    view.setUint32(offset, params.totalChunks);
    offset += 4;
    view.setUint32(offset, params.chunkIndex);
    offset += 4;
    view.setUint32(offset, params.plaintextChunkLength);

    return bytes;
}
