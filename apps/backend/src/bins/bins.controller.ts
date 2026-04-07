import { 
    Controller, Post, Get, Delete, Body, Param, 
    UseGuards, Query, UseInterceptors 
} from '@nestjs/common';
import { BinsService } from './bins.service';
import { JwtAuthGuard } from 'src/auth/guard/auth.guard';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
import { CreateBinDto } from './dto/create-bin.dto';
import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';

@Controller('bins')
@UseInterceptors(TransformInterceptor)
export class BinsController {
    constructor(private readonly binsService: BinsService) {}

    @Post()
    @UseGuards(JwtAuthGuard)
    async create(@GetUserId() userId: string, @Body() dto: CreateBinDto) {
        const bin = await this.binsService.createBin(userId, dto);

        return {
            message: 'Bin successfully created',
            result: { id: bin.id, shareToken: bin.shareToken }
        };
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    async listMyBins(@GetUserId() userId: string) {
        const bins = await this.binsService.getUserBins(userId);
        
        return { 
            message: 'Bins fetched successfully', 
            result: bins 
        };
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    async delete(@GetUserId() userId: string, @Param('id') binId: string) {
        await this.binsService.deleteBin(userId, binId);

        return { 
            message: 'Bin deleted successfully',
            result: null 
        };
    }

    @Get(':id/:token')
    async getBin(
        @Param('id') id: string,
        @Param('token') token: string,
        @Query('password') password?: string
    ) {
        const bin = await this.binsService.getBinContent(id, token, password);
        
        return {
            message: 'Bin fetched successfully',
            result: {
                title: bin.title,
                content: bin.content,
                createdAt: bin.createdAt,
                expiresAt: bin.expiresAt,
                encryptedBinKey: bin.encryptedBinKey,
                binKeyIv: bin.binKeyIv
            }
        };
    }
}