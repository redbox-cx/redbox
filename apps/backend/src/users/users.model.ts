import { $Enums, Prisma, UserRole, UserStatus } from "@prisma/client";


export class User {
    id?: number;
    username: string;
    password: string;
    status?: UserStatus;
    role?: UserRole;
    inviteCode: string;
    sessionKey: string; 
    createdAt?: Date;
}