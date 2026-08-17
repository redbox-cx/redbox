import apiClient from '../api/apiClient';
import { FILE_CHUNK_SIZE } from './FileCryptoFormat';

export const CHUNK_SIZE = FILE_CHUNK_SIZE;

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
        const chunkBuffer = encryptedChunk.byteOffset === 0 && encryptedChunk.byteLength === encryptedChunk.buffer.byteLength
            ? encryptedChunk.buffer as ArrayBuffer
            : encryptedChunk.slice().buffer as ArrayBuffer;

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

    async cancelUpload(uploadId: string): Promise<void> {
        await apiClient.delete(`/files/uploads/${encodeURIComponent(uploadId)}`);
    },

    cancelUploadOnPageExit(uploadId: string): void {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        const apiBase = String(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
        void fetch(`${apiBase}/files/uploads/${encodeURIComponent(uploadId)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
            keepalive: true,
            credentials: 'include',
        }).catch(() => {});
    },

    async getFiles(): Promise<{
        files: FileEntry[];
        totalUsed: number;
        quotaLimit: number;
        maxFileSize: number;
    }> {
        const { data } = await apiClient.get('/files');
        return data.result;
    },

    async deleteFile(fileId: string): Promise<void> {
        await apiClient.delete(`/files/${fileId}`);
    },
};
