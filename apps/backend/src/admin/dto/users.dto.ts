import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { OffsetPaginationQueryDto, toBoolean } from './common.dto';
import { Transform } from 'class-transformer';

class AdminReasonDto {
  @IsString()
  @IsNotEmpty({ message: "Reason can't be empty" })
  @MaxLength(500, { message: "Reason can't be longer than 500 characters" })
  reason: string;
}

export class AdminUsersQueryDto extends OffsetPaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "Search can't be longer than 100 characters" })
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn(['username', 'id'], {
    message: 'Search type must be username or id',
  })
  searchType?: 'username' | 'id';

  @IsOptional()
  @IsString()
  @IsIn(['active', 'banned', 'locked', 'pending'], {
    message: 'Status must be active, banned, locked or pending',
  })
  status?: 'active' | 'banned' | 'locked' | 'pending';

  @IsOptional()
  @IsString()
  @IsIn(['accountCreationDate', 'username'], {
    message: 'Sort must be accountCreationDate or username',
  })
  sort: 'accountCreationDate' | 'username' = 'accountCreationDate';

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'], {
    message: 'Order must be asc or desc',
  })
  order: 'asc' | 'desc' = 'desc';
}

export class UpdateAdminUserStatusDto extends AdminReasonDto {
  @IsString()
  @IsIn(['active', 'locked', 'banned', 'deleted'], {
    message: 'Status must be active, locked, banned or deleted',
  })
  status: 'active' | 'locked' | 'banned' | 'deleted';

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: 'Permanent must be true or false' })
  permanent?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Duration days must be an integer' })
  @Min(1, { message: 'Duration days must be at least 1' })
  durationDays?: number;
}

export class ForceLogoutAdminUserDto extends AdminReasonDto {}

export class ChangeAdminUsernameDto extends AdminReasonDto {
  @IsString()
  @IsNotEmpty({ message: "New username can't be empty" })
  @Length(3, 50, {
    message: 'New username must have between 3 and 50 characters',
  })
  newUsername: string;
}

export class DeleteAdminUserFilesDto extends AdminReasonDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Please provide at least one file id' })
  @ArrayMaxSize(100, { message: "You can't delete more than 100 files at once" })
  @ArrayUnique()
  @IsString({ each: true })
  fileIds: string[];
}
