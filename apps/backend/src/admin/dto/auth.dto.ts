import { IsNotEmpty, IsString, Length, Matches, MaxLength } from 'class-validator';
import { Match } from 'src/common/decorators/match.decorator';

export class AdminLoginDto {
  @IsString()
  @IsNotEmpty({ message: "Username can't be empty" })
  @MaxLength(50, { message: "Username can't be longer than 50 characters" })
  username: string;

  @IsString()
  @IsNotEmpty({ message: "Password can't be empty" })
  password: string;
}

export class AdminChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: "Old password can't be empty" })
  oldPassword: string;

  @IsString()
  @IsNotEmpty({ message: "New password can't be empty" })
  @Length(8, 100, {
    message: 'New password must have at least 8 characters.',
  })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'New password must include at least one uppercase letter, one lowercase letter, and at least one number or special character.',
  })
  newPassword: string;

  @IsString()
  @IsNotEmpty({ message: "New password repeat can't be empty" })
  @Match('newPassword', { message: 'New passwords do not match' })
  newPasswordRepeat: string;
}
