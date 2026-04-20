import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBugReportDto {
  @IsString()
  @IsNotEmpty({ message: "Description can't be empty" })
  @MaxLength(5000, { message: "Description can't be longer than 5000 characters" })
  description: string;

  @IsOptional()
  @IsEmail({}, { message: 'Contact email must be a valid email address' })
  @MaxLength(255, { message: "Contact email can't be longer than 255 characters" })
  contactEmail?: string;
}
