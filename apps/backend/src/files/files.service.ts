import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { join } from 'path';



const prismaHelper = new PrismaClient();



// save everything as .bin file (uuid.bin)
export const storageConfig = {
    limits: {
        fileSize: 2 * 1024 * 1024 * 1024, // 2GB Max per file
    },
    
    fileFilter: async (req, file, callback) => {
        const userId = req.user?.id; 
        if (!userId) return callback(new BadRequestException('User not authenticated'), false);

        // if 2GB are reached, dont write
        const aggregation = await prismaHelper.file.aggregate({
            where: { userId },
            _sum: { size: true },
        });

        const currentUsage = aggregation._sum.size || 0;
        const TWO_GB = 2 * 1024 * 1024 * 1024;

        if (currentUsage >= TWO_GB) {
            return callback(new BadRequestException('Your storage limit is already reached!'), false);
        }

        callback(null, true);
    },
    
    storage: diskStorage({
        destination: (req, file, callback) => {
            const dest = process.env.UPLOAD_LOCATION || './uploads';
            // folder test (upload folder)
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true });
            }
            callback(null, dest);
        },
        filename: (req, file, callback) => {
            callback(null, `${uuidv4()}.bin`);
        },
    }),
};

@Injectable()
export class FilesService {
    constructor(private prisma: PrismaService) {}

    async handleFileUpload(userId: number, file: Express.Multer.File) {
        const TWO_GB = 2 * 1024 * 1024 * 1024;

        // filesize validation
        const aggregation = await this.prisma.file.aggregate({
            where: { userId: userId },
            _sum: { size: true },
        });

        const currentUsage = aggregation._sum.size || 0;

        if (currentUsage + file.size > TWO_GB) {
            // delete when limit reached
            this.deletePhysicalFile(file.path);
            throw new BadRequestException('Upload failed: This file exceeds your 2GB limit.');
        }

        try {
            // save metadata in db
            return await this.prisma.file.create({
                data: {
                    originalName: file.originalname,
                    storageName: file.filename, // uuid.bin
                    size: file.size,
                    mimetype: file.mimetype,
                    userId: userId,
                },
            });
        } catch (error) {
            this.deletePhysicalFile(file.path);
            throw new InternalServerErrorException('Database error during file registration');
        }
    }

    private deletePhysicalFile(path: string) {
        try {
            if (fs.existsSync(path)) {
                fs.unlinkSync(path);
            }
        } catch (err) {
            console.error('Wasnt able to delete file after failed upload!', path);
        }
    }
}