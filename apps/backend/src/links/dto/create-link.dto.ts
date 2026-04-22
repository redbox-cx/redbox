import { IsNotEmpty, IsUrl } from 'class-validator';

export class CreateLinkDto {
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'] },
    { message: 'Please provide a valid URL', },
  )
  @IsNotEmpty({message: "URL can't be empty"})
  url: string;
}
