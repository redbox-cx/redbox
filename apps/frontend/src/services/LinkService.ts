import apiClient from '../api/apiClient';

export interface Link {
    id: string;
    originalUrl: string;
    shortCode: string;
    createdAt: string;
}

export const LinkService = {
    async getAll(): Promise<Link[]> {
        const { data } = await apiClient.get('/links');
        return data.result;
    },

    async createLink(url: string): Promise<Link> {
        const { data } = await apiClient.post('/links', { url });
        return data.result ?? data;
    },

    async deleteLink(id: string): Promise<void> {
        await apiClient.delete(`/links/${id}`);
    },
};
