import { UserAvatar, UserStatus } from "@prisma/client";


export class User {
    id?: string;
    username: string;
    password: string;
    avatar: UserAvatar;
    status: UserStatus;
    sessionKey?: string;
    createdAt?: Date;
    issuedCodes?: number;
}
