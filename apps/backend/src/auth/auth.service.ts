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


    async getTokens(userId: number, username: string) {
        const [at, rt] = await Promise.all([
            this.jwtService.signAsync(
                { sub: userId, username },
                { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '10m'},
            ),
            this.jwtService.signAsync(
                { sub: userId, username },
                { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '3d'},
            ),  
        ]);

        return {access_token: at, refresh_token: rt };
    }


    async updateRtHash(userId: number, rt: string) {
        const hash = await bcrypt.hash(rt, 10);
        await this.prismaService.user.update({
            where: { id: userId },
            data: { hashedRt: hash },
        });
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

        const tokens = await this.getTokens(user.id, user.username);
        await this.updateRtHash(user.id, tokens.refresh_token);

        return tokens;
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
                        status: UserStatus.ACTIVE
                    }
                });

                await prisma.inviteCode.update({
                    where: {id: invite.id},
                    data: {usedCount: {increment: 1}}
                });

                return newUser;
            });

            const tokens = await this.getTokens(result.id, result.username);
            await this.updateRtHash(result.id, tokens.refresh_token);

            return tokens;
        } catch (error) {
            if (error.code === 'P2002') throw new ConflictException('Username already taken')
            throw new BadRequestException('Registration failed');
        }
    }


    async refreshToken(userId: number, rt: string) {
        const user = await this.prismaService.user.findUnique({
            where: { id: userId },
        });

        if (!user || !user.hashedRt) throw new ForbiddenException('Access Denied');

        const rtMatches = await bcrypt.compare(rt, user.hashedRt);
        if (!rtMatches) throw new ForbiddenException('Access Denied');

        const tokens = await this.getTokens(user.id, user.username);
        await this.updateRtHash(user.id, tokens.refresh_token);

        return tokens;
    }


    async logout(userId: number) {
        await this.prismaService.user.updateMany({
            where: {
                id: userId,
                hashedRt: { not:null }
            },
            data: { hashedRt: null },
        });
    }
}
