import apiClient from '../api/apiClient';

export const CHUNK_SIZE = 50 * 1024 * 1024; // 50 MB
// Each encrypted chunk = IV(12) + plaintext(CHUNK_SIZE) + GCM auth tag(16)
export const ENCRYPTED_CHUNK_SIZE = CHUNK_SIZE + 12 + 16;

export interface FileEntry {
    id: string;
    originalName: string;
    size: number;
    mimetype: string;
    createdAt: string;
    expiresAt: string;
    shareLink: string; // e.g. /d/{id}?token={token}#{keyHex}
}

export const FileService = {
    async init(fileSize: number, totalChunks: number, password?: string, expiresIn?: string): Promise<string> {
        const body: Record<string, unknown> = { fileSize, totalChunks };
        if (password) body.password = password;
        if (expiresIn) body.expiresIn = expiresIn;
        const { data } = await apiClient.post('/files/init', body);
        return data.result.uploadId;
    },

    async uploadChunk(uploadId: string, chunkIndex: number, encryptedChunk: Uint8Array): Promise<void> {
        const form = new FormData();
        const chunkBuffer =
            encryptedChunk.buffer instanceof ArrayBuffer
                ? encryptedChunk.buffer.slice(
                    encryptedChunk.byteOffset,
                    encryptedChunk.byteOffset + encryptedChunk.byteLength,
                )
                : new Uint8Array(encryptedChunk).buffer;

        form.append('file', new Blob([chunkBuffer], { type: 'application/octet-stream' }));
        form.append('chunkIndex', String(chunkIndex));
        await apiClient.patch(`/files/upload/${uploadId}`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    async complete(params: {
        uploadId: string;
        fileName: string;
        totalChunks: number;
        mimetype: string;
        fileKey: string;
    }): Promise<{ fileId: string; shareToken: string }> {
        const { data } = await apiClient.post('/files/complete', params);
        return data.result;
    },

    async getFiles(): Promise<{ files: FileEntry[]; totalUsed: number }> {
        const { data } = await apiClient.get('/files');
        return data.result;
    },

    async deleteFile(fileId: string): Promise<void> {
        await apiClient.delete(`/files/${fileId}`);
    },
};
