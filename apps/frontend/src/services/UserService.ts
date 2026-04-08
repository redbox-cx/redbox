import apiClient from '../api/apiClient';

export type UserAvatar = string; // enum key = image filename without extension

export interface UserProfile {
    username: string;
    avatar: UserAvatar;
    createdAt: string;
    issuedCodes: number;
}

export const UserService = {
    async getProfile(): Promise<UserProfile> {
        const { data } = await apiClient.get('/user/profile');
        return data.result;
    },

    async updateAvatar(avatar: UserAvatar): Promise<{ avatar: UserAvatar }> {
        const { data } = await apiClient.post('/user/avatar', { avatar });
        return data.result;
    },
};
