import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class BlogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: "Limit can't be greater than 100" })
  limit = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Offset must be an integer' })
  @Min(0, { message: "Offset can't be negative" })
  offset = 0;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "Search can't be longer than 100 characters" })
  search?: string;
}
