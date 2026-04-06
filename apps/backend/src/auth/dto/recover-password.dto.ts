import { IsNotEmpty, IsString, Length, Matches } from "class-validator";
import { Match } from "src/common/decorators/match.decorator";

export class RecoverPasswordDto {
    @IsString()
    @IsNotEmpty()
    username: string;

    @IsString()
    @IsNotEmpty()
    recoveryPhrase: string; // 24 words phrase

    @IsString()
    @Length(8,100, {
        message: 'New password must be at least 8 characters.'
    })
    @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/,{
        message: 'New password must include at least one uppercase letter, one lowercase letter, and at least one number or special character.'
    })
    newPassword: string;


    @IsString()
    @IsNotEmpty()
    @Match('newPassword', { message: 'New passwords do not match'})
    newPasswordConfirm: string;
}