import { Injectable, UnauthorizedException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma.service';
import { UsersService } from 'src/users/users.service';
import { LoginDto } from './dto/login-user.dto';
import * as bcrypt from 'bcryptjs';
import { RegisterUsersDto } from './dto/register-user.dto';
import { UserRole, UserStatus } from '@prisma/client';
import { randomUUID, scrypt, randomBytes, createCipheriv, createDecipheriv, createHash, generateKeyPairSync } from 'crypto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RecoverPasswordDto } from './dto/recover-password.dto';
import { promisify } from 'util';
import { Redis } from 'ioredis';
import {InjectRedis} from '@nestjs-modules/ioredis';
import * as bip39 from 'bip39';


const scryptAsync = promisify(scrypt);


@Injectable()
export class AuthService {

    constructor(
        private readonly prismaService: PrismaService,
        private jwtService: JwtService,
        private readonly usersService: UsersService,
        @InjectRedis() private readonly redis: Redis 
    ){}


    private async generateMasterKeyStore(secret: string, rawMasterKey: Buffer) {
        const iv = randomBytes(16);
        const salt = randomBytes(16);
        const derivedKey = (await scryptAsync(secret, salt, 32)) as Buffer;
        const cipher = createCipheriv('aes-256-cbc', derivedKey, iv);
        let encrypted = cipher.update(rawMasterKey).toString('hex');
        encrypted += cipher.final().toString('hex');
        return { encrypted, iv: iv.toString('hex'), salt: salt.toString('hex') };
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

    async preValidate(username: string, inviteCode: string) {
        const invite = await this.prismaService.inviteCode.findUnique({
            where: { code: inviteCode }
        });
        if (!invite || invite.usage <= 0) {
            throw new UnauthorizedException('Invalid or expired invite code');
        }

        const existing = await this.prismaService.user.findUnique({
            where: { username }
        });
        if (existing) {
            throw new ConflictException('Username already taken');
        }
    }

    // --- Recovery-Phrase ---
    generateRecoveryPhrase() {
        // generates 24 words
        const mnemonic = bip39.generateMnemonic(256); 
        return {
            phrase: mnemonic,
            words: mnemonic.split(' ')
        };
    }

    // --- helpfunction bcs of the 72-Byte limit of bcrypt ---
    private async hashRecoveryPhrase(phrase: string) {
        // first SHA-256 (64-Bit string), then bcrypt
        const sha256 = createHash('sha256').update(phrase).digest('hex');
        return await bcrypt.hash(sha256, 13);
    }

    private async compareRecoveryPhrase(phrase: string, hash: string) {
        const sha256 = createHash('sha256').update(phrase).digest('hex');
        return await bcrypt.compare(sha256, hash);
    }


    async getTokens(userId: string, username: string, sessionKey: string) {

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
        const { username, password, inviteCode, recoveryPhrase  } = createDto;

        // invite code validation
        const invite = await this.prismaService.inviteCode.findUnique({
            where: { code: inviteCode }
        });

        if (!invite || invite.usage <= 0) {
            throw new UnauthorizedException('Invalid or expired invite code');
        }

        // 1. generate raw masterkey
        const rawMasterKey = randomBytes(32);

        // 2. encrypt masterkey with pwd
        const mkStore = await this.generateMasterKeyStore(password, rawMasterKey);
        
        // 3. encrypt masterkey with recoveryphrase
        const recoveryMkStore = await this.generateMasterKeyStore(recoveryPhrase, rawMasterKey);

        // 4. hash recoveryphrase
        const hashedRecoveryPhrase = await this.hashRecoveryPhrase(recoveryPhrase);

        const { publicKey, privateKey } = generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });

        // encrypt private key with masterkey
        const privIv = randomBytes(16);
        const privCipher = createCipheriv('aes-256-cbc', rawMasterKey, privIv);
        let encPrivateKey = privCipher.update(privateKey).toString('hex');
        encPrivateKey += privCipher.final().toString('hex');
        
        try {
            const result = await this.prismaService.$transaction(async (prisma) => {
                const newUser = await prisma.user.create({
                    data: {
                        username,
                        password: await bcrypt.hash(password, 13),
                        sessionKey: randomUUID(),
                        issuedCodes: 0,
                        
                        // Password-Based Master Key
                        encryptedMasterKey: mkStore.encrypted,
                        masterKeyIv: mkStore.iv,
                        masterKeySalt: mkStore.salt,

                        // Recovery-Based Master Key & Hash
                        recoveryPhraseHash: hashedRecoveryPhrase,
                        recoveryEncryptedMasterKey: recoveryMkStore.encrypted,
                        recoveryMasterKeyIv: recoveryMkStore.iv,
                        recoveryMasterKeySalt: recoveryMkStore.salt,

                        publicKey: publicKey,
                        encryptedPrivateKey: encPrivateKey,
                        privateKeyIv: privIv.toString('hex'),
                    }
                });

                await prisma.inviteCode.update({
                    where: { id: invite.id },
                    data: { usage: { decrement: 1 } }
                });

                return newUser;
            });

            await this.redis.set(`masterkey:${result.id}`, rawMasterKey.toString('hex'), 'EX', 86400);
            return this.getTokens(result.id, result.username, result.sessionKey);

        } catch (error) {
            if (error instanceof Error && 'code' in error) {
                if ((error as any).code === 'P2002') {
                    throw new ConflictException('Username already taken');
                }
            }
            throw new BadRequestException('Registration failed');
        }
    }


    async refreshToken(userId: string, keyFromToken: string) {
        const newSessionKey = randomUUID();
        const result = await this.prismaService.user.updateMany({
            where: { id: userId, sessionKey: keyFromToken },
            data: { sessionKey: newSessionKey }
        });

        if (result.count === 0) {
            throw new ForbiddenException('Access Denied (Session invalid)');
        }

        const updatedUser = await this.prismaService.user.findUnique({
            where: { id: userId }
        });
        await this.redis.expire(`masterkey:${userId}`, 86400);

        return this.getTokens(updatedUser!.id, updatedUser!.username, updatedUser!.sessionKey);
    }


    async logout(userId: string) {
        await this.prismaService.user.update({
            where: { id: userId },
            data: { sessionKey: randomUUID() }
        });
        await this.redis.del(`masterkey:${userId}`);

        return { message: 'Logged out successfully' };
    }

    async changePassword(userId: string, dto: ChangePasswordDto) {
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
        await this.redis.del(`masterkey:${userId}`);

        return { message: 'Password successfully changed. Please log in again.'};
    }

    async recoverPassword(dto: RecoverPasswordDto) {
        const user = await this.prismaService.user.findUnique({
            where: { username: dto.username }
        });

        if (!user) throw new UnauthorizedException('Invalid credentials');

        // 1. Check Phrase
        const isPhraseValid = await this.compareRecoveryPhrase(dto.recoveryPhrase, user.recoveryPhraseHash);
        if (!isPhraseValid) throw new UnauthorizedException('Invalid credentials');

        // 2. Master Key decryption with recoverykey
        const derivedKey = (await scryptAsync(dto.recoveryPhrase, Buffer.from(user.recoveryMasterKeySalt, 'hex'), 32)) as Buffer;
        const decipher = createDecipheriv('aes-256-cbc', derivedKey, Buffer.from(user.recoveryMasterKeyIv, 'hex'));
        let rawMasterKey = decipher.update(Buffer.from(user.recoveryEncryptedMasterKey, 'hex'));
        rawMasterKey = Buffer.concat([rawMasterKey, decipher.final()]);

        // 3. Encrypt Masterkey with the new password
            const newMkStore = await this.generateMasterKeyStore(dto.newPassword, rawMasterKey);

        // 4. DB Update
        await this.prismaService.user.update({
            where: { id: user.id },
            data: {
                password: await bcrypt.hash(dto.newPassword, 13),
                sessionKey: randomUUID(), // kick old sessions
                encryptedMasterKey: newMkStore.encrypted,
                masterKeyIv: newMkStore.iv,
                masterKeySalt: newMkStore.salt
            }
        });

        return { message: 'Password has been successfully reset.' };
    }
}
