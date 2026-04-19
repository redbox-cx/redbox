import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContentReportDto {
  @IsString()
  @IsNotEmpty({ message: "Link can't be empty" })
  @MaxLength(1000, { message: "Link can't be longer than 1000 characters" })
  link: string;

  @IsString()
  @IsNotEmpty({ message: "Reason can't be empty" })
  @MaxLength(2000, { message: "Reason can't be longer than 2000 characters" })
  reason: string;

  @IsOptional()
  @IsEmail({}, { message: 'Reporter email must be a valid email address' })
  @MaxLength(255, { message: "Reporter email can't be longer than 255 characters" })
  reporterEmail?: string;
}
