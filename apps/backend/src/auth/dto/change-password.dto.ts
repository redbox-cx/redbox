import { IsString, IsNotEmpty, Length, Matches } from "class-validator";
import { Match } from "src/common/decorators/match.decorator";

export class ChangePasswordDto {
    @IsString()
    @IsNotEmpty()
    oldPassword: string;

    @IsString()
    @Length(8,100, {
        message: 'Password must have at least 8 characters.'
    })
    @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
        message: 'Password must include at least one uppercase letter, one lowercase letter, and at least one number or special character.'
    })
    newPassword: string;


    @IsString()
    @IsNotEmpty()
    @Match('newPassword', { message: 'New passwords do not match'})
    newPasswordConfirm: string;
}