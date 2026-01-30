import { PrismaService } from 'src/prisma.service';
import { User } from "./users.model";
import { ConflictException, Injectable, InternalServerErrorException, ForbiddenException, BadRequestException } from "@nestjs/common";
import { UserAvatar } from "@prisma/client";
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';



@Injectable()
export class UsersService{

    constructor(private prismaService: PrismaService){}

    async createUser(data:User): Promise<User>{
        const existing = await this.prismaService.user.findUnique({
            where: {
                username: data.username
            }
        })

        if(existing){
            throw new ConflictException('Username already exists')
        }

        try {
            return await this.prismaService.user.create({
                data: {
                    username: data.username,
                    password: data.password,
                    role: data.role,
                    status: data.status,
                    sessionKey: data.sessionKey
                }
            });
        } catch (error) {
            throw new InternalServerErrorException('Error while creating user')
        }
    }


    async getProfile(userId: number) {
        return this.prismaService.user.findUnique({
            where: { id: userId },
            select: {
                username: true,
                avatar: true,
                createdAt: true,
                issuedCodes: true,
            },
        });
    }

    async updateAvatar(userId: number, avatar: UserAvatar) {
        return this.prismaService.user.update({
            where: { id: userId },
            data: { avatar },
            select: { avatar: true },
        });
    }

    async generateInviteCode(userId: number) {
        const user = await this.prismaService.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new ForbiddenException('User not found');
        }


        if (user.issuedCodes >= 2) {
            throw new BadRequestException('Invite-Limit reached');
        }

        const newCodeString = `RB-${randomBytes(8).toString('hex').toUpperCase()}`;

        return await this.prismaService.$transaction(async (prisma) => {

            const newInvite = await prisma.inviteCode.create({
                    data: {
                        code: newCodeString,
                        usage: 1,
                        userId: userId
                    } as Prisma.InviteCodeUncheckedCreateInput
                });

                await prisma.user.update({
                    where: { id: userId },
                    data: { issuedCodes: { increment: 1 } }
                });

                return newInvite;
        });
    }

    async getMyInvites(userId: number) {
        return this.prismaService.inviteCode.findMany({
            where: { 
                userId: userId
            }  as Prisma.InviteCodeWhereInput,
            select: { 
                code: true, 
                usage: true 
            }
        });
    }
}