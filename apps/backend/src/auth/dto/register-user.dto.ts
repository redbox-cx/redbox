import { IsString, Length, Matches } from "class-validator";



export class RegisterUsersDto {
    
    @IsString()
    @Length(5,50)
    username: string;

    @IsString()
    @Length(8,100)
    //@Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    //    message: 'Password too weak'
    //})
    password: string;

    @IsString()
    @Length(0,50)
    inviteCode: string;
}