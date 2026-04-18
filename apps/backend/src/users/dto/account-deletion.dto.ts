import { IsNotEmpty, IsString } from 'class-validator';

export class AccountDeletionPasswordDto {
  @IsString()
  @IsNotEmpty({ message: "Password can't be empty" })
  password: string;
}
