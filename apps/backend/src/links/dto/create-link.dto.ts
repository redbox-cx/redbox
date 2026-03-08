import { IsNotEmpty, IsUrl, MaxLength } from 'class-validator';

export class CreateLinkDto {
  @IsUrl({}, { message: 'Please provide a valid URL' })
  @IsNotEmpty()
  url: string;
}