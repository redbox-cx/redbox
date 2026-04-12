import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';

export class IncomingMailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  from: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  to: string;

  @IsString()
  @IsOptional()
  @MaxLength(10_000)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50_000_000)
  raw: string;
}