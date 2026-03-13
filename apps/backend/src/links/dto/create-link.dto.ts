import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateLinkDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  url: string;
}