import { Injectable, UnauthorizedException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma.service';
import { UsersService } from 'src/users/users.service';
import { LoginDto } from './dto/login-user.dto';
import * as bcrypt from 'bcryptjs';
import { RegisterUsersDto } from './dto/register-user.dto';
import { UserRole, UserStatus } from '@prisma/client';
import { randomUUID, scrypt, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { promisify } from 'util';
import { Redis } from 'ioredis';
import {InjectRedis} from '@nestjs-modules/ioredis';


const scryptAsync = promisify(scrypt);


@Injectable()
export class AuthService {

    constructor(
        private readonly prismaService: PrismaService,
        private jwtService: JwtService,
        private readonly usersService: UsersService,
        @InjectRedis() private readonly redis: Redis 
    ){}


    private async generateMasterKeyStore(password: string) {
        const masterKey = randomBytes(32); 
        const iv = randomBytes(16);
        const salt = randomBytes(16);
        const derivedKey = (await scryptAsync(password, salt, 32)) as Buffer;
        const cipher = createCipheriv('aes-256-cbc', derivedKey, iv);
        let encrypted = cipher.update(masterKey).toString('hex');
        encrypted += cipher.final().toString('hex');
        return { encrypted, iv: iv.toString('hex'), salt: salt.toString('hex'), rawMasterKey: masterKey };
    }

    private async decryptMasterKey(password: string, user: any) {
        const derivedKey = (await scryptAsync(password, Buffer.from(user.masterKeySalt, 'hex'), 32)) as Buffer;
        const decipher = createDecipheriv('aes-256-cbc', derivedKey, Buffer.from(user.masterKeyIv, 'hex'));
        let decrypted = decipher.update(Buffer.from(user.encryptedMasterKey, 'hex'));
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted;
    }

    private async reEncryptMasterKey(rawMasterKey: Buffer, newPassword: string) {
        const iv = randomBytes(16);
        const salt = randomBytes(16);
        const derivedKey = (await scryptAsync(newPassword, salt, 32)) as Buffer;
        const cipher = createCipheriv('aes-256-cbc', derivedKey, iv);
        let encrypted = cipher.update(rawMasterKey).toString('hex');
        encrypted += cipher.final().toString('hex');
        return { encrypted, iv: iv.toString('hex'), salt: salt.toString('hex') };
    }


    async getTokens(userId: number, username: string, sessionKey: string) {

        const payload = { sub: userId, username, sessionKey };

        const [at, rt] = await Promise.all([
            this.jwtService.signAsync(
                payload,
                { 
                secret: process.env.JWT_ACCESS_SECRET, 
                expiresIn: (process.env.EXPIRES_IN_ACCESS || '5m') as any 
            },
            ),
            this.jwtService.signAsync(
                payload,
                { 
                secret: process.env.JWT_REFRESH_SECRET, 
                expiresIn: (process.env.EXPIRES_IN_REFRESH || '1d') as any
            },
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

        const masterKey = await this.decryptMasterKey(loginDto.password, user);
        await this.redis.set(`masterkey:${user.id}`, masterKey.toString('hex'), 'EX', 86400);

        return this.getTokens(user.id, user.username, user.sessionKey);
    }


    async register(createDto: RegisterUsersDto): Promise<any> {
        const { username, password, inviteCode } = createDto;

        // invite code validation
        const invite = await this.prismaService.inviteCode.findUnique({
            where: { code: inviteCode }
        });

        if (!invite || invite.usage <= 0) {
            throw new UnauthorizedException('Invalid or expired invite code');
        }

        const mk = await this.generateMasterKeyStore(createDto.password);
        
        try {
            // transaction: create user and count -1 code usage
            const result = await this.prismaService.$transaction(async (prisma) => {
                const newUser = await prisma.user.create({
                    data: {
                        username: createDto.username,
                        password: await bcrypt.hash(createDto.password, 13),
                        sessionKey: randomUUID(),
                        encryptedMasterKey: mk.encrypted,
                        masterKeyIv: mk.iv,
                        masterKeySalt: mk.salt,
                        issuedCodes: 0,
                }
                });

                await prisma.inviteCode.update({
                    where: { id: invite.id },
                    data: { usage: { decrement: 1 } }
                });

                return newUser;
            });

            await this.redis.set(`masterkey:${result.id}`, mk.rawMasterKey.toString('hex'), 'EX', 86400);
            return this.getTokens(result.id, result.username, result.sessionKey);

        } catch (error) {
            if (error.code === 'P2002') {
                throw new ConflictException('Username already taken');
            }
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

    async changePassword(userId: number, dto: ChangePasswordDto) {
        const user = await this.prismaService.user.findUnique({
            where: { id: userId }
        });
        
        if (!user) throw new ForbiddenException('User not found');

        const pwMatches = await bcrypt.compare(dto.oldPassword, user.password);
        if (!pwMatches) throw new UnauthorizedException('Old password incorrect');
        
        const rawMasterKey = await this.decryptMasterKey(dto.oldPassword, user);

        const newMkStore = await this.reEncryptMasterKey(rawMasterKey, dto.newPassword);

        await this.prismaService.user.update({
            where: { id: userId },
            data: {
                password: await bcrypt.hash(dto.newPassword, 13),
                sessionKey: randomUUID(), // kick old sessions
                encryptedMasterKey: newMkStore.encrypted,
                masterKeyIv: newMkStore.iv,
                masterKeySalt: newMkStore.salt
            },
        });

        return { message: 'Password changed sucessfully. Please log in again.'};
    }
}
