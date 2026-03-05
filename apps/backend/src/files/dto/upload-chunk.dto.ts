import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadChunkDto {
    @Type(() => Number)
    @IsNotEmpty()
    chunkIndex: number;
}