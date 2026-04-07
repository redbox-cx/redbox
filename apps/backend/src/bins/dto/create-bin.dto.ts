import { IsString, IsNotEmpty, MaxLength, IsOptional, Matches, IsNumber } from 'class-validator';

export class CreateBinDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(3000000, { message: 'Encrypted content exceeds limit' }) 
    content: string;

    @IsNumber()
    size: number;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    title?: string;

    @IsString()
    @IsOptional()
    password?: string;

    @IsString()
    @IsOptional()
    @Matches(/^(never|\d+[dh])$/, { message: 'Expiration must be "never", or like "30d", "12h"' })
    expiresIn?: string;

    @IsString()
    @IsNotEmpty()
    encryptedBinKey: string;

    @IsString()
    @IsNotEmpty()
    binKeyIv: string;
}