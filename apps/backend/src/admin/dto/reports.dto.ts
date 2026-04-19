import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { OffsetPaginationQueryDto } from './common.dto';

export class AdminContentReportsQueryDto extends OffsetPaginationQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['open', 'archived'], {
    message: 'Status must be either open or archived',
  })
  status?: 'open' | 'archived';
}

class AdminReportReasonDto {
  @IsString()
  @IsNotEmpty({ message: "Reason can't be empty" })
  @MaxLength(500, { message: "Reason can't be longer than 500 characters" })
  reason: string;
}

export class ResolveAdminReportDto extends AdminReportReasonDto {}

export class DeleteReportedContentDto extends AdminReportReasonDto {}

export class BanReportedUserDto extends AdminReportReasonDto {
  @IsString()
  @IsIn(['30d', 'permanent', 'custom'], {
    message: 'Duration must be 30d, permanent or custom',
  })
  duration: '30d' | 'permanent' | 'custom';

  @ValidateIf((value: BanReportedUserDto) => value.duration === 'custom')
  @Type(() => Number)
  @IsInt({ message: 'Custom days must be an integer' })
  @Min(1, { message: 'Custom days must be at least 1' })
  customDays?: number;
}
