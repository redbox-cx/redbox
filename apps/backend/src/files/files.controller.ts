import { Controller, Post, Patch, Delete, Get, Body, Req, UseGuards, UseInterceptors, UploadedFile, Param, Res, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService, storageConfig } from './files.service';
import { JwtAuthGuard } from 'src/auth/guard/auth.guard';
import express from 'express';
import { pipeline } from 'stream/promises';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
    constructor(private readonly filesService: FilesService) {}


    // get my files and quota
    @Get()
    async listMyFiles(@Req() req) {
        return this.filesService.getUserFilesWithQuota(req.user.id);
    }


    // handshake start
    @Post('init')
    async init(@Req() req, @Body() body: { fileSize: number }) {
        return this.filesService.initializeUpload(req.user.id || req.user.sub, body.fileSize);
    }

    // send chunks
    @Patch('upload-chunk/:uploadId')
    @UseInterceptors(FileInterceptor('file', storageConfig))
    async uploadChunk(
        @Param('uploadId') uploadId: string,
        @UploadedFile() file: Express.Multer.File,
        @Body('chunkIndex') chunkIndex: string,
        @Req() req
    ) {
        return this.filesService.handleChunk(req.user.id, uploadId, file, parseInt(chunkIndex));
    }

    // merge chunks
    @Post('complete')
    async complete(@Req() req, @Body() body: { uploadId: string; fileName: string; totalChunks: number; mimetype: string }) {
        // exec in background to prevent from timeouts
        this.filesService.finalizeUpload(req.user.id, body.uploadId, body.fileName, body.totalChunks, body.mimetype)
            .catch(err => console.error("Merge Error:", err));

        return { status: 'Processing' };
    }

    // delete endpoint
    @Delete(':id')
    async delete(@Req() req, @Param('id') fileId: string) {
        await this.filesService.deleteFile(req.user.id, fileId);
        return { status: 'Ok', message: 'File deleted' };
    }

    // download endpoint
    @Get('download/:id')
    async download(@Param('id') id: string, @Req() req, @Res() res: express.Response) {

        const { stream, fileName, mimeType } = await this.filesService.downloadFile(req.user.id, id);

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        await pipeline(stream, res);
    }
}