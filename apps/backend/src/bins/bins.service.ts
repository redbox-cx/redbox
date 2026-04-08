import { 
    Injectable, 
    BadRequestException, 
    ForbiddenException, 
    NotFoundException, 
    Logger, 
    UnauthorizedException 
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import * as bcrypt from 'bcryptjs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { addDays, addHours } from 'date-fns';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { CreateBinDto } from './dto/create-bin.dto';

@Injectable()
export class BinsService {
    private readonly logger = new Logger(BinsService.name);

    constructor(
        private prisma: PrismaService,
        @InjectRedis() private readonly redis: Redis
    ) {}

    private get binLimit(): number {
        return Number(process.env.BIN_LIMIT ?? 100);
    }


    private calculateExpiration(expiresIn?: string): Date | null {
        if (!expiresIn || expiresIn === '30d') return addDays(new Date(), 30);
        if (expiresIn === 'never') return null;

        const amount = parseInt(expiresIn.slice(0, -1));
        if (isNaN(amount)) return addDays(new Date(), 30);
        const unit = expiresIn.slice(-1);

        if (unit === 'd') return addDays(new Date(), amount);
        if (unit === 'h') return addHours(new Date(), amount);
        
        return addDays(new Date(), 30);
    }


    async createBin(userId: string, dto: CreateBinDto) {
        // get masterkey from redis
        const masterKeyHex = await this.redis.get(`masterkey:${userId}`);
        if (!masterKeyHex) throw new UnauthorizedException('Session expired');
        const masterKey = Buffer.from(masterKeyHex, 'hex');

        const currentBinCount = await this.prisma.bin.count({
            where: { userId: userId },
        });

        if (currentBinCount >= this.binLimit) {
            throw new BadRequestException(`You have reached your limit of ${this.binLimit} bins.`);
        }

        // encrypt binkey sent by frontend
        const binKeyIv = randomBytes(16);
        const cipher = createCipheriv('aes-256-cbc', masterKey, binKeyIv);
        let encryptedBinKey = cipher.update(dto.binKey, 'utf8', 'hex');
        encryptedBinKey += cipher.final('hex');

        // hash password (optional)
        const passwordHash = dto.password ? await bcrypt.hash(dto.password, 12) : null;
        const expiresAt = this.calculateExpiration(dto.expiresIn);

        // save in mariadb
        return await this.prisma.bin.create({
            data: {
                content: dto.content,
                size: dto.size,
                title: dto.title || 'Untitled Bin',
                userId,
                expiresAt,
                passwordHash,
                encryptedBinKey,
                binKeyIv: binKeyIv.toString('hex')
            }
        });
    }


    async getUserBins(userId: string) {

        const masterKeyHex = await this.redis.get(`masterkey:${userId}`);
        if (!masterKeyHex) throw new UnauthorizedException('Session expired');
        const masterKey = Buffer.from(masterKeyHex, 'hex');

        const bins = await this.prisma.bin.findMany({
            where: { userId },
            select: {
                id: true,
                title: true,
                size: true,
                createdAt: true,
                expiresAt: true,
                shareToken: true,
                encryptedBinKey: true,
                binKeyIv: true
            },
            orderBy: { createdAt: 'desc' }
        });

        const processedBins = bins.map(bin => {
            let decryptedKey = "";
            try {
                const decipher = createDecipheriv('aes-256-cbc', masterKey, Buffer.from(bin.binKeyIv, 'hex'));
                decryptedKey = decipher.update(bin.encryptedBinKey, 'hex', 'utf8');
                decryptedKey += decipher.final('utf8');
            } catch (e) { 
                decryptedKey = "error"; 
            }

            return {
                id: bin.id,
                title: bin.title,
                size: bin.size,
                createdAt: bin.createdAt,
                expiresAt: bin.expiresAt,
                shareLink: `/b/${bin.id}?token=${bin.shareToken}#${decryptedKey}`
            };
        });

        return processedBins;
    }


    async getBinContent(binId: string, token: string, providedPassword?: string) {
        const bin = await this.prisma.bin.findUnique({ where: { id: binId } });

        if (!bin || bin.shareToken !== token) {
            throw new NotFoundException('Bin not found or invalid token');
        }

        // test expiry
        if (bin.expiresAt && new Date() > bin.expiresAt) {
            await this.prisma.bin.delete({ where: { id: bin.id } });
            throw new NotFoundException('Bin has expired');
        }

        // password-gatekeeper
        if (bin.passwordHash) {
            if (!providedPassword) throw new ForbiddenException('This bin is password protected');
            const isMatch = await bcrypt.compare(providedPassword, bin.passwordHash);
            if (!isMatch) throw new ForbiddenException('Incorrect password');
        }


        return {
            title: bin.title,
            content: bin.content, // encrypted text blob
            createdAt: bin.createdAt,
            expiresAt: bin.expiresAt,
        };
    }


    async deleteBin(userId: string, binId: string) {
        const bin = await this.prisma.bin.findUnique({ where: { id: binId } });
        if (!bin) throw new NotFoundException('Bin not found');
        if (bin.userId !== userId) throw new NotFoundException('Bin not found');

        await this.prisma.bin.delete({ where: { id: binId } });
        return { message: 'Bin deleted successfully' };
    }

    // --- CRON JOB: AUTO CLEANUP ---
    @Cron(CronExpression.EVERY_HOUR)
    async handleCleanup() {
        try {
            const result = await this.prisma.bin.deleteMany({
                where: { expiresAt: { lt: new Date() } }
            });
            if (result.count > 0) {
                this.logger.log(`Auto-deleted ${result.count} expired bins.`);
            }
        } catch (error) {
            this.logger.error('Error during bin cleanup', error);
        }
    }
}