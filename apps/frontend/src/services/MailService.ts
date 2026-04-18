import apiClient from '../api/apiClient';

export interface MailListItem {
    id: string;
    subject: string | null;
    from: string;
    to: string;
    isRead: boolean;
    folder: string;
    createdAt: string;
}

export interface MailDetail extends MailListItem {
    content: string;
    userId: string;
}

export type MailFolder = 'inbox' | 'archive' | 'spam' | 'all';
export type MailSort = 'newest' | 'oldest' | 'unread' | 'read';

export const MailService = {
    async getAll(limit = 50, offset = 0, sort: MailSort = 'newest', folder: MailFolder = 'inbox'): Promise<{ mails: MailListItem[]; totalCount: number }> {
        const { data } = await apiClient.get('/mail', { params: { limit, offset, sort, folder } });
        return data.result;
    },

    async getById(id: string): Promise<MailDetail> {
        const { data } = await apiClient.get(`/mail/${id}`);
        return data.result;
    },

    async deleteMail(id: string): Promise<void> {
        await apiClient.delete(`/mail/${id}`);
    },

    async setReadStatus(id: string, isRead: boolean): Promise<void> {
        await apiClient.patch(`/mail/${id}/read-status`, { isRead });
    },

    async moveMail(id: string, folder: MailFolder): Promise<void> {
        await apiClient.patch(`/mail/${id}/move`, { folder });
    },

    async blockSender(email: string): Promise<void> {
        await apiClient.post('/mail/block-sender', { email });
    },

    async bulkDelete(mailIds: string[]): Promise<void> {
        await apiClient.post('/mail/bulk/delete', { mailIds });
    },

    async bulkSetReadStatus(mailIds: string[], isRead: boolean): Promise<void> {
        await apiClient.post('/mail/bulk/read-status', { mailIds, isRead });
    },

    async bulkMove(mailIds: string[], folder: MailFolder): Promise<void> {
        await apiClient.post('/mail/bulk/move', { mailIds, folder });
    },

    async getStorage(): Promise<{ usedMb: number; maxMb: number }> {
        const { data } = await apiClient.get('/mail/storage');
        return data.result;
    },
};
