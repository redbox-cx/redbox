import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class InternalLoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}

export class InternalValidateDto {
  @IsString()
  @IsNotEmpty({ message: 'Token is required' })
  token: string;
}

export class InternalProfileDto {
  @IsUUID('4', { message: 'userId must be a valid UUID' })
  userId: string;
}
