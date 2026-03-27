import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Length, Matches, Min } from 'class-validator';

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
    @Matches(/^[0-9a-fA-F]{64}$/, { message: 'fileKey must be a 64-character hex string' })
    fileKey: string;
}