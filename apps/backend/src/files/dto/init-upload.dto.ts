import { IsIn, IsInt, Min, Max, IsOptional, IsString, Length } from 'class-validator';

const FILE_EXPIRY_OPTIONS = ['1h', '24h', '7d', '30d'] as const;

export class InitUploadDto {
    @IsInt()
    @Min(1, {message: "You can't upload empty files"})
    @Max(53687091200, {message: "You can't upload more than 50 GiB"})
    fileSize: number;

    @IsInt()
    @Min(1, {message: "At least 1 chunk is required"})
    @Max(1024, {message: "You can't upload more than 1024 chunks at once"})
    totalChunks: number;

    @IsString()
    @IsOptional()
    @Length(1,100, {
            message: 'Password must not have more than 100 characters'
        })
    password?: string;

    @IsString()
    @IsOptional()
    @IsIn(FILE_EXPIRY_OPTIONS, {
        message: 'Expiration must be 1h, 24h, 7d or 30d'
    })
    expiresIn?: string;
}
