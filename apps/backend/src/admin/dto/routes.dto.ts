import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class PauseAdminRouteDto {
  @IsString()
  @IsNotEmpty({ message: "Reason can't be empty" })
  @MaxLength(500, { message: "Reason can't be longer than 500 characters" })
  reason: string;
}