import { $Enums, Prisma } from "@prisma/client";


export class Users implements Prisma.UserCreateInput{
    username: string;
    password: string;
    status?: $Enums.UserStatus | undefined;
    inviteCode: string;

}