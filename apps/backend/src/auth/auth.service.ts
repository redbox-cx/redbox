import { Injectable, UnauthorizedException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma.service';
import { UsersService } from 'src/users/users.service';
import { LoginDto } from './dto/login-user.dto';
import * as bcrypt from 'bcryptjs';
import { RegisterUsersDto } from './dto/register-user.dto';
import { User } from 'src/users/users.model';
import { UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class AuthService {

    constructor(
        private readonly prismaService: PrismaService,
        private jwtService: JwtService,
        private readonly usersService: UsersService
    ){}


    async getTokens(userId: number, username: string, version: number) {

        const payload = { sub: userId, username, version };

        const [at, rt] = await Promise.all([
            this.jwtService.signAsync(
                { sub: userId, username },
                { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '10m'},
            ),
            this.jwtService.signAsync(
                { sub: userId, username },
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

        return this.getTokens(user.id, user.username, user.tokenVersion);
    }


    async register (createDto: RegisterUsersDto): Promise<any>{

        const { username, password, inviteCode } = createDto;

        const invite = await this.prismaService.inviteCode.findUnique({
            where: {code: inviteCode}
        });

        if (!invite) {
            throw new UnauthorizedException('Invalid invite code')
        }

        if (invite.usedCount >= invite.maxUses) {
            throw new BadRequestException('Invite code has no uses left')
        }


        try {
            const result = await this.prismaService.$transaction(async (prisma) => {
                const hashedPassword = await bcrypt.hash(password, 10);

                const newUser = await prisma.user.create({
                    data: {
                        username,
                        password: hashedPassword,
                        inviteCode,
                        role: UserRole.USER,
                        status: UserStatus.ACTIVE,
                        tokenVersion: 1
                    }
                });

                await prisma.inviteCode.update({
                    where: {id: invite.id},
                    data: {usedCount: {increment: 1}}
                });

                return newUser;
            });

            return this.getTokens(result.id, result.username, result.tokenVersion);

        } catch (error) {
            if (error.code === 'P2002') throw new ConflictException('Username already taken')
            throw new BadRequestException('Registration failed');
        }
    }


    async refreshToken(userId: number, versionInToken: number) {
        const user = await this.prismaService.user.findUnique({
            where: { id: userId },
        });

        if (!user || user.tokenVersion !== versionInToken) {throw new ForbiddenException('Access Denied');}

        const updatedUser = await this.prismaService.user.update({
            where: { id: userId },
            data: { tokenVersion: { increment: 1 } }
        });

        return this.getTokens(updatedUser.id, updatedUser.username, updatedUser.tokenVersion);
    }


    async logout(userId: number) {
        await this.prismaService.user.update({
            where: {
                id: userId,
            },
            data: { tokenVersion: { increment: 1 } }
        });

        return { message: 'Logged out successfully' };
    }
}
