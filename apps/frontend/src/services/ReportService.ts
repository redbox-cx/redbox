import apiClient from '../api/apiClient';

export const ReportService = {
    async reportBug(dto: { description: string; contactEmail?: string; attachments?: File[] }): Promise<void> {
        const form = new FormData();
        form.append('description', dto.description);
        if (dto.contactEmail?.trim()) form.append('contactEmail', dto.contactEmail.trim());
        dto.attachments?.forEach(f => form.append('attachments', f));
        await apiClient.post('/reports/bugs', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    async reportContent(dto: { link: string; reason: string; reporterEmail?: string; contentPassword?: string }): Promise<void> {
        const { contentPassword, link, ...rest } = dto;
        const hashIndex = link.indexOf('#');
        const baseLink = hashIndex !== -1 ? link.slice(0, hashIndex) : link;
        const hashFragment = hashIndex !== -1 ? link.slice(hashIndex) : '';
        const linkWithPassword = contentPassword
            ? `${baseLink}${baseLink.includes('?') ? '&' : '?'}password=${encodeURIComponent(contentPassword)}`
            : baseLink;
        const finalLink = `${linkWithPassword}${hashFragment}`;
        await apiClient.post('/reports/content', { ...rest, link: finalLink });
    },
};
