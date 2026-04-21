import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { OffsetPaginationQueryDto, toBoolean } from 'src/admin/dto/common.dto';

export const NOTIFICATION_CATEGORIES = [
  'info',
  'warning',
  'error',
  'success',
  'maintenance',
] as const;

export type NotificationCategoryApi = (typeof NOTIFICATION_CATEGORIES)[number];

export class SystemNotificationsQueryDto extends OffsetPaginationQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(NOTIFICATION_CATEGORIES, {
    message: 'Category must be info, warning, error, success or maintenance',
  })
  category?: NotificationCategoryApi;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: 'activeOnly must be true or false' })
  activeOnly?: boolean;
}

export class CreateSystemNotificationDto {
  @IsString()
  @IsIn(NOTIFICATION_CATEGORIES, {
    message: 'Category must be info, warning, error, success or maintenance',
  })
  category: NotificationCategoryApi;

  @IsString()
  @MaxLength(1000, { message: "Message can't be longer than 1000 characters" })
  message: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'durationSeconds must be an integer' })
  @Min(1, { message: 'durationSeconds must be at least 1' })
  @Max(60 * 60 * 24 * 30, { message: "durationSeconds can't be longer than 30 days" })
  durationSeconds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'durationMinutes must be an integer' })
  @Min(1, { message: 'durationMinutes must be at least 1' })
  @Max(60 * 24 * 30, { message: "durationMinutes can't be longer than 30 days" })
  durationMinutes?: number;

  @IsOptional()
  @IsISO8601({}, { message: 'expiresAt must be an ISO timestamp' })
  expiresAt?: string;
}
