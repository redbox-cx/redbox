import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { OffsetPaginationQueryDto } from './common.dto';

export class AdminLogsQueryDto extends OffsetPaginationQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['debug', 'info', 'warn', 'error'], {
    message: 'Level must be debug, info, warn or error',
  })
  level?: 'debug' | 'info' | 'warn' | 'error';

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "Search can't be longer than 100 characters" })
  search?: string;
}