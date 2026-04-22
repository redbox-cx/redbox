import { 
    Controller, Post, Get, Delete, Body, Param, 
    UseGuards, UseInterceptors, Req
} from '@nestjs/common';
import { BinsService } from './bins.service';
import { JwtAuthGuard } from 'src/auth/guard/auth.guard';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
import { CreateBinDto } from './dto/create-bin.dto';
import { GetBinDto } from './dto/get-bin.dto';
import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';
import { RateLimit } from 'src/common/rate-limit/rate-limit.decorators';
import { RateLimitGuard } from 'src/common/rate-limit/rate-limit.guard';
import { RateLimitService } from 'src/common/rate-limit/rate-limit.service';
import type { Request } from 'express';

@Controller('bins')
@UseInterceptors(TransformInterceptor)
export class BinsController {
    constructor(
        private readonly binsService: BinsService,
        private readonly rateLimitService: RateLimitService,
    ) {}

    @Post()
    @UseGuards(JwtAuthGuard, RateLimitGuard)
    @RateLimit({ name: 'bins:create:user', limit: 30, windowSeconds: 60 * 60, subject: 'user' })
    async create(@GetUserId() userId: string, @Body() dto: CreateBinDto) {
        const bin = await this.binsService.createBin(userId, dto);

        return {
            message: 'Bin successfully created',
            result: { id: bin.id, shareToken: bin.shareToken }
        };
    }

    @Get()
    @UseGuards(JwtAuthGuard, RateLimitGuard)
    @RateLimit({ name: 'bins:list:user', limit: 60, windowSeconds: 60, subject: 'user' })
    async listMyBins(@GetUserId() userId: string) {
        const bins = await this.binsService.getUserBins(userId);
        
        return { 
            message: 'Bins fetched successfully', 
            result: bins 
        };
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RateLimitGuard)
    @RateLimit({ name: 'bins:delete:user', limit: 30, windowSeconds: 60, subject: 'user' })
    async delete(@GetUserId() userId: string, @Param('id') binId: string) {
        await this.binsService.deleteBin(userId, binId);

        return { 
            message: 'Bin deleted successfully',
            result: null 
        };
    }

    @Get(':id/:token')
    @UseGuards(RateLimitGuard)
    @RateLimit({ name: 'bins:get:ip', limit: 120, windowSeconds: 60, subject: 'ip' })
    async getBin(
        @Param('id') id: string,
        @Param('token') token: string,
        @Req() request?: Request
    ) {
        return this.fetchBin(id, token, request);
    }

    @Post(':id/:token')
    @UseGuards(RateLimitGuard)
    @RateLimit({ name: 'bins:get:ip', limit: 120, windowSeconds: 60, subject: 'ip' })
    async getBinWithPassword(
        @Param('id') id: string,
        @Param('token') token: string,
        @Body() dto: GetBinDto,
        @Req() request?: Request
    ) {
        return this.fetchBin(id, token, request, dto.password);
    }

    private async fetchBin(
        id: string,
        token: string,
        request?: Request,
        password?: string,
    ) {
        const bin = await this.binsService.getBinContent(
            id,
            token,
            password,
            request ? this.rateLimitService.getClientIp(request) : 'unknown',
        );
        
        return {
            message: 'Bin fetched successfully',
            result: bin
        };
    }
}
