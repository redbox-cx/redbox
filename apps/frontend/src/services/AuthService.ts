import apiClient from '../api/apiClient';

export const AuthService = {
    async login(dto: any) {
        const { data } = await apiClient.post('/auth/login', dto);
        return data; 
    },

    async register(dto: any) {
        const { data } = await apiClient.post('/auth/register', dto);
        return data; 
    },

    async getMe() {
        const { data } = await apiClient.get('/auth/me');
        return data;
    }
};