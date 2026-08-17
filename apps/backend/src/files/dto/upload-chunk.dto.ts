import { IsInt, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadChunkDto {
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(204)
    chunkIndex: number;
}
