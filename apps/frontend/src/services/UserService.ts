import apiClient from '../api/apiClient';

export type UserAvatar = string;

export interface UserProfile {
    username: string;
    avatar: UserAvatar;
    createdAt: string;
    issuedCodes: number;
}

export interface InviteCode {
    id: string;
    code: string;
    usage: number;
    isValid: boolean;
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

    async getInvites(): Promise<InviteCode[]> {
        const { data } = await apiClient.get('/user/invites');
        return data.result;
    },

    async generateInvite(): Promise<InviteCode> {
        const { data } = await apiClient.post('/user/invites');
        return data.result;
    },
};
