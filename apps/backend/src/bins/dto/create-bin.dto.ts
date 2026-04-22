import { Type } from 'class-transformer';
import {
    IsIn,
    IsInt,
    IsString,
    IsNotEmpty,
    Max,
    MaxLength,
    Min,
    IsOptional,
    Length,
    Matches,
} from 'class-validator';

const BIN_EXPIRY_OPTIONS = ['1h', '24h', '7d', '30d', 'never'] as const;

export class CreateBinDto {
    @IsString()
    @IsNotEmpty({message: "Content can't be empty"})
    @MaxLength(3000000, { message: 'Encrypted content exceeds limit' }) 
    content: string;

    @Type(() => Number)
    @IsInt({ message: 'Size must be an integer' })
    @Min(1, { message: "Size can't be smaller than 1 byte" })
    @Max(3_000_000, { message: "Size can't be larger than 3MB" })
    size: number;

    @IsString()
    @IsOptional()
    @MaxLength(100, {message: "Title can't be longer than 100 characters"})
    title?: string;

    @IsString()
    @IsOptional()
    @Length(1,100, { message: 'Password must have between 1 and 100 characters' })
    password?: string;

    @IsString()
    @IsOptional()
    @IsIn(BIN_EXPIRY_OPTIONS, { message: 'Expiration must be 1h, 24h, 7d, 30d or never' })
    expiresIn?: string;

    @IsString()
    @IsNotEmpty()
    @Matches(/^[0-9a-fA-F]{64}$/, { message: 'binKey must be a 64-character hex string' })
    binKey: string;
}
