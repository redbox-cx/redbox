import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class IncomingMailDto {
  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsOptional()
  subject: string;

  @IsString()
  @IsNotEmpty()
  raw: string;
}