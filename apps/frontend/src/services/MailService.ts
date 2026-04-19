import apiClient from '../api/apiClient';

export interface MailAttachment {
    id: string;
    filename: string;
    mimetype: string;
    size: number;
}

export interface MailListItem {
    id: string;
    subject: string | null;
    from: string;
    to: string;
    isRead: boolean;
    folder: string;
    createdAt: string;
    hasAttachments: boolean;
    attachmentCount: number;
}

export interface MailDetail extends MailListItem {
    content: string;
    userId: string;
    attachments: MailAttachment[];
}

export type MailFolder = 'inbox' | 'archive' | 'spam' | 'all';
export type MailSort = 'newest' | 'oldest' | 'unread' | 'read';

export const MailService = {
    async getAll(limit = 50, offset = 0, sort: MailSort = 'newest', folder: MailFolder = 'inbox', search?: string): Promise<{ mails: MailListItem[]; totalCount: number }> {
        const { data } = await apiClient.get('/mail', { params: { limit, offset, sort, folder, ...(search ? { search } : {}) } });
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

    async downloadAttachment(mailId: string, attachmentId: string, filename: string): Promise<void> {
        const response = await apiClient.get(`/mail/${mailId}/attachment/${attachmentId}`, { responseType: 'blob' });
        const url = URL.createObjectURL(response.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    async getStorage(): Promise<{ usedMb: number; maxMb: number }> {
        const { data } = await apiClient.get('/mail/storage');
        return data.result;
    },
};
