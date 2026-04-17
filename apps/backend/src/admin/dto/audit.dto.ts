import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { OffsetPaginationQueryDto } from './common.dto';

export class AuditLogsQueryDto extends OffsetPaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: "adminId can't be longer than 50 characters" })
  adminId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50, { message: "Action can't be longer than 50 characters" })
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50, { message: "targetUserId can't be longer than 50 characters" })
  targetUserId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'From must be a valid ISO date' })
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'To must be a valid ISO date' })
  to?: string;
}