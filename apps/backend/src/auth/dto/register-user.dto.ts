import { IsNotEmpty, IsString, Length, Matches } from "class-validator";
import { Match } from "src/common/decorators/match.decorator";



export class RegisterUsersDto {
    
    @IsString()
    @Length(5,50)
    username: string;

    @IsString()
    @Length(8,100, {
        message: 'Password must be at least 8 characters.'
    })
    @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/,{
        message: 'Password must include at least one uppercase letter, one lowercase letter, and at least one number or special character.'
    })
    password: string;


    @IsString()
    @IsNotEmpty()
    @Match('password', { message: 'Passwords do not match'})
    passwordConfirm: string;

    @IsString()
    @Length(0,50)
    inviteCode: string;
}