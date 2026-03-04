import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CompleteUploadDto {
    @IsString()
    @IsNotEmpty()
    @IsUUID()
    uploadId: string;

    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsInt()
    @Min(1)
    totalChunks: number;

    @IsString()
    @IsOptional()
    mimetype: string;
}