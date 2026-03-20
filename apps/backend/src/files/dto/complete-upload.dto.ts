import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class CompleteUploadDto {
    @IsString()
    @IsNotEmpty()
    @IsUUID()
    uploadId: string;

    @IsString()
    @IsNotEmpty()
    @Length(1,100, {
                message: 'Filename must not have more than 100 characters'
            })
    fileName: string;

    @IsInt()
    @Min(1)
    totalChunks: number;

    @IsString()
    @IsOptional()
    mimetype: string;

    @IsString()
    @IsNotEmpty()
    @Length(64,64)
    fileKey: string; 
}