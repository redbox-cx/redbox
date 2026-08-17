import { IsIn, IsInt, Min, Max, IsOptional, IsString, Length } from 'class-validator';

const FILE_EXPIRY_OPTIONS = ['1h', '24h', '7d', '30d'] as const;

export class InitUploadDto {
    @IsInt()
    @Min(1, {message: "You can't upload empty files"})
    @Max(10737418240, {message: "You can't upload more than 10GB"})
    fileSize: number;

    @IsInt()
    @Min(1, {message: "At least 1 chunk is required"})
    @Max(205, {message: "You can't upload more than 205 chunks at once"})
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
