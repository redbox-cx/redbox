import { IsJWT, IsNotEmpty, IsString } from 'class-validator';

export class ReactivateAccountDto {
  @IsString()
  @IsNotEmpty({ message: 'Reactivation token is required' })
  @IsJWT({ message: 'Reactivation token must be a valid JWT' })
  reactivationToken: string;
}
