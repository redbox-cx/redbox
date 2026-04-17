import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { OffsetPaginationQueryDto } from './common.dto';

export class AdminContentReportsQueryDto extends OffsetPaginationQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['open', 'archived'], {
    message: 'Status must be either open or archived',
  })
  status?: 'open' | 'archived';
}

export class ResolveAdminReportDto {
  @IsString()
  @IsNotEmpty({ message: "Action taken can't be empty" })
  @MaxLength(500, { message: "Action taken can't be longer than 500 characters" })
  actionTaken: string;
}