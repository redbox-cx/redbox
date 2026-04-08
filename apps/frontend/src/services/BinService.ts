import apiClient from '../api/apiClient';

export interface BinEntry {
    id: string;
    title: string | null;
    size: number;
    createdAt: string;
    expiresAt: string | null;
    shareLink: string; // backend: /b/${id}?token=${shareToken}#${decryptedKey}
}

export interface BinContent {
    title: string;
    content: string;
    createdAt: string;
    expiresAt: string | null;
}

export const BinService = {
    async create(dto: {
        content: string;
        size: number;
        title?: string;
        password?: string;
        expiresIn?: string;
        binKey: string;
    }): Promise<{ id: string; shareToken: string }> {
        const { data } = await apiClient.post('/bins', dto);
        return data.result;
    },

    async getAll(): Promise<BinEntry[]> {
        const { data } = await apiClient.get('/bins');
        return data.result;
    },

    async get(id: string, token: string, password?: string): Promise<BinContent> {
        const params = password ? { password } : {};
        const { data } = await apiClient.get(`/bins/${id}/${token}`, { params });
        return data.result;
    },

    async deleteBin(id: string): Promise<void> {
        await apiClient.delete(`/bins/${id}`);
    },
};
