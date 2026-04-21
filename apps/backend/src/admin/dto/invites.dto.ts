import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { OffsetPaginationQueryDto, toBoolean } from './common.dto';

export class AdminInviteCodesQueryDto extends OffsetPaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: "Search can't be longer than 50 characters" })
  search?: string;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: 'isValid must be true or false' })
  isValid?: boolean;
}

export class CreateAdminInviteCodeDto {
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: "Invite code can't be longer than 50 characters" })
  @Matches(/^[A-Za-z0-9_-]+(?:-[A-Za-z0-9_-]+)*$/, {
    message: 'Invite code can only contain letters, numbers, underscores and hyphens',
  })
  code?: string;

  @Type(() => Number)
  @IsInt({ message: 'Usage must be an integer' })
  @Min(1, { message: 'Usage must be at least 1' })
  @Max(100000, { message: "Usage can't be greater than 100000" })
  usage: number;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: 'isValid must be true or false' })
  isValid?: boolean;
}

export class CreateRandomAdminInviteCodeDto {
  @Type(() => Number)
  @IsInt({ message: 'Usage must be an integer' })
  @Min(1, { message: 'Usage must be at least 1' })
  @Max(100000, { message: "Usage can't be greater than 100000" })
  usage: number;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: 'isValid must be true or false' })
  isValid?: boolean;
}

export class UpdateAdminInviteCodeValidityDto {
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: 'isValid must be true or false' })
  isValid: boolean;
}
