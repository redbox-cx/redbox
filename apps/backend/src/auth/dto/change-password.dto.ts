import { IsString, IsNotEmpty, Length, Matches } from "class-validator";
import { Match } from "src/common/decorators/match.decorator";

export class ChangePasswordDto {
    @IsString()
    @IsNotEmpty({message: "Old password can't be empty"})
    oldPassword: string;

    @IsString()
    @IsNotEmpty({message: "New password can't be empty"})
    @Length(8,100, {
        message: 'New password must have at least 8 characters.'
    })
    @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
        message: 'New password must include at least one uppercase letter, one lowercase letter, and at least one number or special character.'
    })
    newPassword: string;


    @IsString()
    @IsNotEmpty({message: "New password can't be empty"})
    @Match('newPassword', { message: 'New passwords do not match'})
    newPasswordConfirm: string;
}