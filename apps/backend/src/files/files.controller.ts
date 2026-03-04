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
    async init(@Req() req, @Body() body: { fileSize: number, totalChunks: number }) {
        return this.filesService.initializeUpload(
        req.user.id || req.user.sub, 
        body.fileSize, 
        body.totalChunks
    );
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
        try {
            const userId = req.user.id || req.user.sub;

            // await for result
            const fileRecord = await this.filesService.finalizeUpload(
                userId, 
                body.uploadId, 
                body.fileName, 
                body.totalChunks, 
                body.mimetype
            );

            // if success: delete meta data in redis
            await this.filesService['redis'].del(`upload:meta:${userId}:${body.uploadId}`);

            return { 
                status: 'Ok', 
                message: 'File successfully stored.',
                fileId: fileRecord.id,
                fileName: fileRecord.originalName,
                size: fileRecord.size
            };
        } catch (err) {
            // catch error
            console.error("Merge Error:", err);
            return {
                status: 'Error',
                message: err.message || 'An unexpected error occurred during merging'
            };
        }
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