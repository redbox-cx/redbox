import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import * as bcrypt from 'bcryptjs';
import { CreateBinDto } from './dto/create-bin.dto';
import { addDays, addHours } from 'date-fns';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class BinsService {
    private readonly logger = new Logger(BinsService.name);

    constructor(private prisma: PrismaService) {}

    // calculate expiry date
    private calculateExpiration(expiresIn?: string): Date | null {
        if (!expiresIn || expiresIn === '30d') return addDays(new Date(), 30);
        if (expiresIn === 'never') return null;

        const amount = parseInt(expiresIn.slice(0, -1));
        const unit = expiresIn.slice(-1);

        if (unit === 'd') return addDays(new Date(), amount);
        if (unit === 'h') return addHours(new Date(), amount);
        
        return addDays(new Date(), 30);
    }

    async createBin(userId: string, dto: CreateBinDto) {
        const expiresAt = this.calculateExpiration(dto.expiresIn);
        const passwordHash = dto.password ? await bcrypt.hash(dto.password, 12) : null;

        return this.prisma.bin.create({
            data: {
                content: dto.content,
                size: dto.size,
                title: dto.title || 'Untitled Bin',
                userId,
                expiresAt,
                passwordHash,
                encryptedBinKey: dto.encryptedBinKey,
                binKeyIv: dto.binKeyIv
            }
        });
    }

    // meta data endpoint
    async getUserBins(userId: string) {
        return this.prisma.bin.findMany({
            where: { userId },
            select: {
                id: true,
                title: true,
                size: true,
                createdAt: true,
                expiresAt: true,
                shareToken: true,
                binKeyIv: true,
                encryptedBinKey: true,
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async deleteBin(userId: string, binId: string) {
        const bin = await this.prisma.bin.findUnique({ where: { id: binId } });
        if (!bin) throw new NotFoundException('Bin not found');
        if (bin.userId !== userId) throw new NotFoundException('Bin not found');

        await this.prisma.bin.delete({ where: { id: binId } });
        return { message: 'Bin deleted successfully' };
    }

    async getBinContent(binId: string, token: string, password?: string) {
        const bin = await this.prisma.bin.findUnique({ where: { id: binId } });

        if (!bin || bin.shareToken !== token) {
            throw new NotFoundException('Bin not found or invalid token');
        }

        // Expiration check
        if (bin.expiresAt && new Date() > bin.expiresAt) {
            await this.prisma.bin.delete({ where: { id: bin.id } });
            throw new NotFoundException('Bin has expired');
        }

        // Password check
        if (bin.passwordHash) {
            if (!password) throw new ForbiddenException('Password required');
            const isMatch = await bcrypt.compare(password, bin.passwordHash);
            if (!isMatch) throw new ForbiddenException('Incorrect password');
        }

        return {
            title: bin.title,
            content: bin.content,
            createdAt: bin.createdAt,
            expiresAt: bin.expiresAt,
            encryptedBinKey: bin.encryptedBinKey,
            binKeyIv: bin.binKeyIv
        };
    }

    // --- AUTO CLEANUP ---
    @Cron(CronExpression.EVERY_HOUR)
    async handleCleanup() {
        const result = await this.prisma.bin.deleteMany({
            where: { expiresAt: { lt: new Date() } }
        });
        if (result.count > 0) {
            this.logger.log(`Auto-deleted ${result.count} expired bins.`);
        }
    }
}