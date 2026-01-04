import { IsString, Length } from "class-validator";



export class LoginDto {

    @IsString()
    @Length(5,20)
    username: string;

    @IsString()
    @Length(8,100)
    password: string;
}