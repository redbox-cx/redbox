import { 
    Controller, Post, Get, Param, Res, Req, 
    UseGuards, UseInterceptors, UploadedFile, 
    ForbiddenException, NotFoundException 
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "src/auth/guard/auth.guard";
import { FilesService, storageConfig } from "./files.service";
import { PrismaService } from "src/prisma.service";
import express from "express";
import { join } from "path";


@Controller('/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
    constructor(
        private readonly filesService: FilesService,
        private readonly prisma: PrismaService
    ) {}


    @Post('/upload')
    @UseInterceptors(FileInterceptor('file', storageConfig))
    async uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req) {
        return this.filesService.handleFileUpload(req.user.id, file);
    }


     @Get('/download/:id')
    async getFile(@Param('id') fileId: string, @Req() req, @Res() res: express.Response) {
        // file info from db
        const fileRecord = await this.prisma.file.findUnique({ 
            where: { id: fileId } 
        });

        if (!fileRecord) throw new NotFoundException('File not found');

        // does user own that file?
        if (fileRecord.userId !== req.user.id) {
            throw new ForbiddenException('You do not have permission to download this file');
        }

        // fix path and send
        const filePath = join(process.env.UPLOAD_LOCATION || './uploads', fileRecord.storageName);
        
        return res.download(filePath, fileRecord.originalName);
    }
}