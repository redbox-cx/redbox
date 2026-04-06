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

    async deleteLink(id: string): Promise<void> {
        await apiClient.delete(`/links/${id}`);
    },
};
