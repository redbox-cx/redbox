import { Injectable, UnauthorizedException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma.service';
import { UsersService } from 'src/users/users.service';
import { LoginDto } from './dto/login-user.dto';
import * as bcrypt from 'bcryptjs';
import { RegisterUsersDto } from './dto/register-user.dto';
import { User } from 'src/users/users.model';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {

    constructor(
        private readonly prismaService: PrismaService,
        private jwtService: JwtService,
        private readonly usersService: UsersService
    ){}


    async getTokens(userId: number, username: string, sessionKey: string) {

        const payload = { sub: userId, username, sessionKey };

        const [at, rt] = await Promise.all([
            this.jwtService.signAsync(
                payload,
                { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '10m'},
            ),
            this.jwtService.signAsync(
                payload,
                { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '1d'},
            ),  
        ]);

        return {access_token: at, refresh_token: rt };
    }


    async login(loginDto: LoginDto):Promise<any>{
        const {username,password} = loginDto;


        const user =await this.prismaService.user.findUnique({
            where: {username}
        })

        if(!user){
            throw new UnauthorizedException('Invalid username or password')
        }

        const isPasswordValid = await bcrypt.compare(password,user.password)

        if(!isPasswordValid){
            throw new UnauthorizedException('Invalid username or password')
        }

        return this.getTokens(user.id, user.username, user.sessionKey);
    }


    async register (createDto: RegisterUsersDto): Promise<any>{

        const { username, password, inviteCode } = createDto;

        const invite = await this.prismaService.inviteCode.findUnique({
            where: {code: inviteCode}
        });

        if (!invite) {
            throw new UnauthorizedException('Invalid or expired invite code')
        }

        if (invite.usage <= 0) {
            throw new BadRequestException('Invalid or expired invite code')
        }


        try {
            const result = await this.prismaService.$transaction(async (prisma) => {
                const hashedPassword = await bcrypt.hash(password, 10);

                const newUser = await prisma.user.create({
                    data: {
                        username,
                        password: hashedPassword,
                        role: UserRole.USER,
                        status: UserStatus.ACTIVE,
                        sessionKey: randomUUID()
                    }
                });

                await prisma.inviteCode.update({
                    where: {id: invite.id},
                    data: { usage: { decrement: 1 } }
                });

                return newUser;
            });

            return this.getTokens(result.id, result.username, result.sessionKey);

        } catch (error) {
            if (error.code === 'P2002') throw new ConflictException('Username already taken')
            throw new BadRequestException('Registration failed');
        }
    }


    async refreshToken(userId: number, keyFromToken: string) {
        const user = await this.prismaService.user.findUnique({
            where: { id: userId },
        });

        if (!user || user.sessionKey !== keyFromToken) {throw new ForbiddenException('Access Denied (Session invalid)');}

        const updatedUser = await this.prismaService.user.update({
            where: { id: userId },
            data: { sessionKey: randomUUID()}
        });

        return this.getTokens(updatedUser.id, updatedUser.username, updatedUser.sessionKey);
    }


    async logout(userId: number) {
        await this.prismaService.user.update({
            where: {
                id: userId,
            },
            data: { sessionKey: randomUUID()}
        });

        return { message: 'Logged out successfully' };
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
