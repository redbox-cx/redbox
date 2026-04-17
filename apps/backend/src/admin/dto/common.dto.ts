import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export function toBoolean(value: unknown): boolean | unknown | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === 'true') {
      return true;
    }

    if (normalizedValue === 'false') {
      return false;
    }
  }

  return value;
}

export class OffsetPaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: "Limit can't be greater than 100" })
  limit = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Offset must be an integer' })
  @Min(0, { message: "Offset can't be negative" })
  offset = 0;
}

export class OptionalBooleanQueryDto {
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: 'Value must be true or false' })
  value?: boolean;
}