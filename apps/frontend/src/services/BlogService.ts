import apiClient from '../api/apiClient';

export interface BlogAuthor {
    name: string;
    title: string;
}

export interface BlogPostSummary {
    id: string;
    postId: string;
    title: string;
    subtitle: string;
    author: BlogAuthor;
    timestamp: string;
    status: string;
    categories: string[];
    publishedAt: string;
    contentSize: number;
}

export interface BlogPost extends BlogPostSummary {
    markdown: string;
}

export interface BlogPagination {
    limit: number;
    offset: number;
    returned: number;
    hasMore: boolean;
    total: number;
}

export const BlogService = {
    async getAll(limit = 20, offset = 0): Promise<{ items: BlogPostSummary[]; pagination: BlogPagination }> {
        const { data } = await apiClient.get('/blog', { params: { limit, offset } });
        return data.result;
    },

    async getById(id: string): Promise<BlogPost> {
        const { data } = await apiClient.get(`/blog/${id}`);
        return data.result;
    },
};
