import { IsString, IsNotEmpty, MaxLength, IsOptional, Matches, IsNumber } from 'class-validator';

export class CreateBinDto {
    @IsString()
    @IsNotEmpty({message: "Content can't be empty"})
    @MaxLength(3000000, { message: 'Encrypted content exceeds limit' }) 
    content: string;

    @IsNumber()
    size: number;

    @IsString()
    @IsOptional()
    @MaxLength(100, {message: "Title can't be longer than 100 characters"})
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
    @Matches(/^[0-9a-fA-F]{64}$/, { message: 'binKey must be a 64-character hex string' })
    binKey: string;
}