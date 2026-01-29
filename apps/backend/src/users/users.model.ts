import { $Enums, Prisma, UserAvatar, UserRole, UserStatus } from "@prisma/client";


export class User {
    id?: number;
    username: string;
    password: string;
    avatar: UserAvatar;
    status: UserStatus;
    role?: UserRole;
    sessionKey?: string;
    createdAt?: Date;
    issuedCodes?: number;
}