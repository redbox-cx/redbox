import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
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

    constructor(private readonly prismaService: PrismaService,private jwtService: JwtService,private readonly usersService: UsersService){}


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

        return {
            token: this.jwtService.sign({username: user.username, sub: user.id})
        }
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

            return {
                token: this.jwtService.sign({username: result.username, sub: result.id})
            };
        } catch (error) {
            if (error.code === 'P2002') {
                throw new ConflictException('Username already taken')
            }
            throw new BadRequestException('Registration failed');
        }
    }
}
