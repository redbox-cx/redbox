import { IsOptional, IsString, Length } from 'class-validator';

export class GetBinDto {
  @IsOptional()
  @IsString()
  @Length(1, 100, {
    message: 'Password must have between 1 and 100 characters',
  })
  password?: string;
}
