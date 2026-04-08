import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Length, Matches, Min } from 'class-validator';

export class CompleteUploadDto {
    @IsString()
    @IsNotEmpty({message: "uploadId can't be empty"})
    @IsUUID()
    uploadId: string;

    @IsString()
    @IsNotEmpty({message: "fileName can't be empty"})
    @Length(1,100, {
                message: 'Filename must have between 1-100 characters'
            })
    fileName: string;

    @IsInt()
    @Min(1, {message: "At least 1 chunk is required"})
    totalChunks: number;

    @IsString()
    @IsOptional()
    mimetype: string;

    @IsString()
    @IsNotEmpty({message: "fileKey can't be empty"})
    @Matches(/^[0-9a-fA-F]{64}$/, { message: 'fileKey must be a 64-character hex string' })
    fileKey: string;
}