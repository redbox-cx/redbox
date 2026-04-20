import apiClient from '../api/apiClient';

export const ReportService = {
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
