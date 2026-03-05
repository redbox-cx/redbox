import { 
    Controller, Post, Patch, Delete, Get, 
    Body, UseGuards, UseInterceptors, UploadedFile, 
    Param, Res 
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
@UseGuards(JwtAuthGuard)
export class FilesController {
    constructor(private readonly filesService: FilesService) {}


    // get my files and quota
    @Get()
    async listMyFiles(@GetUserId() userId: number) {
        return this.filesService.getUserFilesWithQuota(userId);
    }


    // handshake start
    @Post('init')
    async init(@GetUserId() userId: number, @Body() dto: InitUploadDto) {
        const result = await this.filesService.initializeUpload(userId, dto.fileSize, dto.totalChunks);
        return {
            message: 'Upload initialized',
            result
        };
    }


    // send chunks
    @Patch('upload-chunk/:uploadId')
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
            message: 'File successfully processed and encrypted',
            result: { fileId: file.id }
        };
    }

    // delete endpoint
    @Delete(':id')
    async delete(@GetUserId() userId: number, @Param('id') fileId: string) {
        await this.filesService.deleteFile(userId, fileId);
        return { message: 'File deleted successfully' };
    }

    // download endpoint
    @Get('download/:id')
    async download(
        @GetUserId() userId: number, 
        @Param('id') id: string, 
        @Res() res: Response
    ) {
        const { stream, fileName, mimeType } = await this.filesService.downloadFile(userId, id);

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        await pipeline(stream, res);
    }
}