import { IsInt, Min, Max, IsOptional, IsString, Length } from 'class-validator';

export class InitUploadDto {
    @IsInt()
    @Min(1)
    @Max(2147483648) // max 2GB
    fileSize: number;

    @IsInt()
    @Min(1)
    @Max(1000) // max 100 chunks
    totalChunks: number;

    @IsString()
    @IsOptional()
    @Length(1,100, {
            message: 'Password must not have more than 100 characters'
        })
    password?: string;
}