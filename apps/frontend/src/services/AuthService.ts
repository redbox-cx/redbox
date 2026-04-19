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

    async logout() {
        const { data } = await apiClient.post('/auth/logout');
        return data;
    },

    async getMe() {
        const { data } = await apiClient.get('/user/profile');
        return data.result;
    },

    async preValidate(dto: { username: string; password: string; passwordConfirm: string; inviteCode: string }) {
        const { data } = await apiClient.post('/auth/pre-validate', dto);
        return data;
    },

    async generatePhrase(): Promise<{ phrase: string; words: string[] }> {
        const { data } = await apiClient.get('/auth/recovery-phrase/generate');
        return data.result;
    },

    async changePassword(dto: { oldPassword: string; newPassword: string; newPasswordConfirm: string }) {
        const { data } = await apiClient.post('/auth/password', dto);
        return data;
    },

    async recoverPassword(dto: {
        username: string;
        recoveryPhrase: string;
        newPassword: string;
        newPasswordConfirm: string;
    }) {
        const { data } = await apiClient.post('/auth/recover-password', dto);
        return data;
    },

    async reactivateAccount(reactivationToken: string) {
        const { data } = await apiClient.post('/auth/account/reactivate', { reactivationToken });
        return data;
    },
};