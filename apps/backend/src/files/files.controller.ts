import { 
    Controller, Post, Patch, Delete, Get, 
    Body, UseGuards, UseInterceptors, UploadedFile, 
    Param, Res, Header,
    Query,
    StreamableFile,
    BadRequestException,
    Req,
    ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService, storageConfig } from './files.service';
import { JwtAuthGuard } from 'src/auth/guard/auth.guard';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
import type { Response } from 'express';
import { InitUploadDto } from './dto/init-upload.dto';
import { UploadChunkDto } from './dto/upload-chunk.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { DownloadFileDto } from './dto/download-file.dto';
import { RateLimit } from 'src/common/rate-limit/rate-limit.decorators';
import { RateLimitGuard } from 'src/common/rate-limit/rate-limit.guard';
import { RateLimitService } from 'src/common/rate-limit/rate-limit.service';
import type { Request } from 'express';
import { UploadChunkConcurrencyGuard } from './upload-chunk-concurrency.guard';

@Controller('files')
export class FilesController {
    constructor(
        private readonly filesService: FilesService,
        private readonly rateLimitService: RateLimitService,
    ) {}


    // get my files and quota
    @Get()
    @UseGuards(JwtAuthGuard, RateLimitGuard)
    @RateLimit({ name: 'files:list:user', limit: 60, windowSeconds: 60, subject: 'user' })
    async listMyFiles(@GetUserId() userId: string) {
        const result = await this.filesService.getUserFilesWithQuota(userId);
        return { message: 'Files fetched successfully', result };
    }


    // handshake start
    @Post('init')
    @UseGuards(JwtAuthGuard, RateLimitGuard)
    @RateLimit(
        { name: 'files:init:user', limit: 30, windowSeconds: 60 * 60, subject: 'user' },
        { name: 'files:init:ip', limit: 60, windowSeconds: 60 * 60, subject: 'ip' },
    )
    async init(@GetUserId() userId: string, @Body() dto: InitUploadDto) {
        const result = await this.filesService.initializeUpload(
            userId, 
            dto.fileSize, 
            dto.totalChunks, 
            dto.password,
            dto.expiresIn
        );
        return {
            message: 'Upload initialized',
            result
        };
    }


    // send chunks
    @Patch('upload/:uploadId')
    @UseGuards(JwtAuthGuard, RateLimitGuard, UploadChunkConcurrencyGuard)
    @RateLimit({ name: 'files:upload:user-upload', limit: 1100, windowSeconds: 24 * 60 * 60, subject: 'param-user', paramName: 'uploadId' })
    @UseInterceptors(FileInterceptor('file', storageConfig))
    async uploadChunk(
        @GetUserId() userId: string,
        @Param('uploadId') uploadId: string,
        @UploadedFile() file: Express.Multer.File,
        @Body() dto: UploadChunkDto,
    ) {
        return this.filesService.handleChunk(userId, uploadId, file, Number(dto.chunkIndex));
    }

    // merge chunks
    @Post('complete')
    @UseGuards(JwtAuthGuard, RateLimitGuard)
    @RateLimit({ name: 'files:complete:user', limit: 40, windowSeconds: 60 * 60, subject: 'user' })
    async complete(
        @GetUserId() userId: string, 
        @Body() dto: CompleteUploadDto
    ) {
        const file = await this.filesService.finalizeUpload(
            userId, 
            dto.uploadId, 
            dto.fileName, 
            dto.mimetype ?? 'application/octet-stream',
            dto.fileKey,
            dto.totalChunks,
        );
        
        return {
            message: 'File successfully processed',
            result: { fileId: file.id, shareToken: file.shareToken }
        };
    }

    @Delete('uploads/:uploadId')
    @UseGuards(JwtAuthGuard, RateLimitGuard)
    @RateLimit({ name: 'files:cancel-upload:user', limit: 60, windowSeconds: 60 * 60, subject: 'user' })
    async cancelUpload(
        @GetUserId() userId: string,
        @Param('uploadId', new ParseUUIDPipe()) uploadId: string,
    ) {
        await this.filesService.cancelUpload(userId, uploadId);
        return { message: 'Upload cancelled' };
    }

    // delete endpoint
    @Delete(':id')
    @UseGuards(JwtAuthGuard, RateLimitGuard)
    @RateLimit({ name: 'files:delete:user', limit: 30, windowSeconds: 60, subject: 'user' })
    async delete(@GetUserId() userId: string, @Param('id') fileId: string) {
        await this.filesService.deleteFile(userId, fileId);
        return { message: 'File deleted successfully' };
    }

    // download endpoint
    @Get('download/:id/metadata')
    @UseGuards(RateLimitGuard)
    @Header('Cache-Control', 'private, no-store')
    @RateLimit(
        { name: 'files:download-metadata:ip', limit: 60, windowSeconds: 60, subject: 'ip' },
        { name: 'files:download-metadata:file-ip', limit: 120, windowSeconds: 60 * 60, subject: 'param-ip', paramName: 'id' },
    )
    async downloadMetadata(
        @Param('id') id: string,
        @Query('token') token: string,
        @Req() request: Request,
    ) {
        if (!token) throw new BadRequestException('Share token is required');
        const result = await this.filesService.getDownloadMetadata(
            id,
            token,
            undefined,
            this.rateLimitService.getClientIp(request),
        );
        return { message: 'Download metadata fetched', result };
    }

    @Post('download/:id/metadata')
    @UseGuards(RateLimitGuard)
    @Header('Cache-Control', 'private, no-store')
    @RateLimit(
        { name: 'files:download-metadata:ip', limit: 60, windowSeconds: 60, subject: 'ip' },
        { name: 'files:download-metadata:file-ip', limit: 120, windowSeconds: 60 * 60, subject: 'param-ip', paramName: 'id' },
    )
    async downloadMetadataWithPassword(
        @Param('id') id: string,
        @Query('token') token: string,
        @Body() dto: DownloadFileDto,
        @Req() request: Request,
    ) {
        if (!token) throw new BadRequestException('Share token is required');
        const result = await this.filesService.getDownloadMetadata(
            id,
            token,
            dto.password,
            this.rateLimitService.getClientIp(request),
        );
        return { message: 'Download metadata fetched', result };
    }

    @Get('download/:id')
    @UseGuards(RateLimitGuard)
    @RateLimit(
        { name: 'files:download:ip', limit: 40, windowSeconds: 60, subject: 'ip' },
        { name: 'files:download:file-ip', limit: 120, windowSeconds: 60 * 60, subject: 'param-ip', paramName: 'id' },
    )
    async download(
        @Param('id') id: string,
        @Query('token') token: string,
        @Res({ passthrough: true }) res: Response,
        @Req() request: Request,
    ) {
        return this.streamDownload(id, token, res, request);
    }

    @Post('download/:id')
    @UseGuards(RateLimitGuard)
    @RateLimit(
        { name: 'files:download:ip', limit: 40, windowSeconds: 60, subject: 'ip' },
        { name: 'files:download:file-ip', limit: 120, windowSeconds: 60 * 60, subject: 'param-ip', paramName: 'id' },
    )
    async downloadWithPassword(
        @Param('id') id: string,
        @Query('token') token: string,
        @Body() dto: DownloadFileDto,
        @Res({ passthrough: true }) res: Response,
        @Req() request: Request,
    ) {
        return this.streamDownload(id, token, res, request, dto.password);
    }

    private async streamDownload(
        id: string,
        token: string,
        res: Response,
        request: Request,
        password?: string,
    ) {
        if (!token) throw new BadRequestException('Share token is required');
        let fileData: Awaited<ReturnType<FilesService['downloadFile']>> | undefined;
        let responseClosed = false;

        res.once('close', () => {
            responseClosed = true;
            if (!res.writableEnded) {
                fileData?.stream.destroy();
            }
        });

        fileData = await this.filesService.downloadFile(
            id,
            token,
            password,
            this.rateLimitService.getClientIp(request),
        );
        if (responseClosed || res.destroyed) {
            fileData.stream.destroy();
            return new StreamableFile(fileData.stream);
        }
        // ASCII-safe fallback + RFC 5987 encoded name so browsers preserve the real filename
        const safeName = fileData.fileName.replace(/[^\w.\-]/g, '_');
        const encodedName = encodeURIComponent(fileData.fileName);
        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(fileData.encryptedSize),
            'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
            'X-Redbox-Format': fileData.format,
            'X-Redbox-Plaintext-Length': String(fileData.plaintextSize),
            'X-Redbox-Chunk-Size': String(fileData.chunkSize),
            'X-Redbox-Chunk-Count': String(fileData.chunkCount),
            'X-Redbox-Encryption-Overhead': String(fileData.encryptionOverhead),
            'X-Redbox-Mime-Type': encodeURIComponent(fileData.mimeType),
            'Cache-Control': 'private, no-store, no-transform',
            'X-Content-Type-Options': 'nosniff',
        });

        return new StreamableFile(fileData.stream);
    }
}
