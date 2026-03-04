import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadChunkDto {
    @Type(() => Number) // string to number
    @IsInt()
    @Min(0)
    chunkIndex: number;
}