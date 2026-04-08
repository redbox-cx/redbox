import { IsNotEmpty, IsUrl } from 'class-validator';

export class CreateLinkDto {
  @IsUrl(
    { require_protocol: true, },
    { message: 'The URL must start with http:// or https://', },
  )
  @IsNotEmpty({message: "URL can't be empty"})
  url: string;
}