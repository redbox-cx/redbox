import { IsInt, Min, Max } from 'class-validator';

export class InitUploadDto {
    @IsInt()
    @Min(1)
    @Max(2147483648) // max 2GB
    fileSize: number;

    @IsInt()
    @Min(1)
    @Max(1000) // max 100 chunks
    totalChunks: number;
}