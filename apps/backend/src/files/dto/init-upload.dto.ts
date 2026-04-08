import { IsInt, Min, Max, IsOptional, IsString, Length } from 'class-validator';

export class InitUploadDto {
    @IsInt()
    @Min(1, {message: "You can't upload empty files"})
    @Max(2147483648, {message: "You can't upload more than 2GB"}) // max 2GB
    fileSize: number;

    @IsInt()
    @Min(1, {message: "At least 1 chunk is required"})
    @Max(100, {message: "You can't upload more than 100 chunks at once"}) // max 100 chunks
    totalChunks: number;

    @IsString()
    @IsOptional()
    @Length(1,100, {
            message: 'Password must not have more than 100 characters'
        })
    password?: string;
}