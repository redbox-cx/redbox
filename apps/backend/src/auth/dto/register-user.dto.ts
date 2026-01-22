import { IsString, Length } from "class-validator";



export class RegisterUsersDto {
    
    @IsString()
    @Length(5,50)
    username: string;

    @IsString()
    @Length(8,100)
    password: string;

    @IsString()
    @Length(4,50)
    inviteCode: string;
}