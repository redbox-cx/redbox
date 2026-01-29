import { PrismaService } from "src/prisma.service";
import { User } from "./users.model";
import { ConflictException, Injectable, InternalServerErrorException } from "@nestjs/common";



@Injectable()
export class UsersService{

    constructor(private prisma: PrismaService){}

    async createUser(data:User): Promise<User>{
        const existing = await this.prisma.user.findUnique({
            where: {
                username: data.username
            }
        })

        if(existing){
            throw new ConflictException('Username already exists')
        }

        try {
            return await this.prisma.user.create({
                data: {
                    username: data.username,
                    password: data.password,
                    inviteCode: data.inviteCode,
                    role: data.role,
                    status: data.status,
                    sessionKey: data.sessionKey
                }
            });
        } catch (error) {
            throw new InternalServerErrorException('Error while creating user')
        }
    }
}