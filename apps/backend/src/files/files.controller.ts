import { 
    Controller, Post, Patch, Delete, Get, 
    Body, UseGuards, UseInterceptors, UploadedFile, 
    Param, Res, 
    Query,
    StreamableFile,
    BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService, storageConfig } from './files.service';
import { JwtAuthGuard } from 'src/auth/guard/auth.guard';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
import type { Response } from 'express';
import { pipeline } from 'stream/promises';
import { InitUploadDto } from './dto/init-upload.dto';
import { UploadChunkDto } from './dto/upload-chunk.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';

@Controller('files')
export class FilesController {
    constructor(private readonly filesService: FilesService) {}


    // get my files and quota
    @Get()
    @UseGuards(JwtAuthGuard)
    async listMyFiles(@GetUserId() userId: number) {
        return this.filesService.getUserFilesWithQuota(userId);
    }


    // handshake start
    @Post('init')
    @UseGuards(JwtAuthGuard)
    async init(@GetUserId() userId: number, @Body() dto: InitUploadDto) {
        const result = await this.filesService.initializeUpload(
            userId, 
            dto.fileSize, 
            dto.totalChunks, 
            dto.password
        );
        return {
            message: 'Upload initialized',
            result
        };
    }


    // send chunks
    @Patch('upload-chunk/:uploadId')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('file', storageConfig))
    async uploadChunk(
        @GetUserId() userId: number,
        @Param('uploadId') uploadId: string,
        @UploadedFile() file: Express.Multer.File,
        @Body() dto: UploadChunkDto,
    ) {
        return this.filesService.handleChunk(userId, uploadId, file, Number(dto.chunkIndex));
    }

    // merge chunks
    @Post('complete')
    @UseGuards(JwtAuthGuard)
    async complete(
        @GetUserId() userId: number, 
        @Body() dto: CompleteUploadDto
    ) {
        const file = await this.filesService.finalizeUpload(
            userId, 
            dto.uploadId, 
            dto.fileName, 
            dto.totalChunks, 
            dto.mimetype
        );
        
        return {
            message: 'File successfully processed',
            result: { fileId: file.id, shareToken: file.shareToken }
        };
    }

    // delete endpoint
    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    async delete(@GetUserId() userId: number, @Param('id') fileId: string) {
        await this.filesService.deleteFile(userId, fileId);
        return { message: 'File deleted successfully' };
    }

    // download endpoint
    @Get('download/:id')
    async download(
        @Param('id') id: string,
        @Query('token') token: string,
        @Res({ passthrough: true }) res: Response,
        @Query('password') password?: string
    ) {
        if (!token) throw new BadRequestException('Share token is required');
        const fileData = await this.filesService.downloadFile(id, token, password);

        // headers
        res.set({
            'Content-Type': fileData.mimeType,
            'Content-Disposition': `attachment; filename="${fileData.fileName}"`,
        });

        return new StreamableFile(fileData.stream);
    }
}