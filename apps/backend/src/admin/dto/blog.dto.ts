import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { OffsetPaginationQueryDto } from './common.dto';

const BLOG_STATUSES = ['draft', 'published', 'withdrawn'] as const;

export class BlogAuthorDto {
  @IsString()
  @MaxLength(80, { message: "Author name can't be longer than 80 characters" })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "Author title can't be longer than 100 characters" })
  title?: string;
}

export class AdminBlogQueryDto extends OffsetPaginationQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(BLOG_STATUSES, { message: 'Status must be draft, published or withdrawn' })
  status?: 'draft' | 'published' | 'withdrawn';

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "Search can't be longer than 100 characters" })
  search?: string;
}

export class SaveAdminBlogPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: "Title can't be longer than 150 characters" })
  title?: string;

  @IsString()
  @MaxLength(300, { message: "Subtitle can't be longer than 300 characters" })
  subtitle: string;

  @ValidateNested()
  @Type(() => BlogAuthorDto)
  author: BlogAuthorDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: "You can't add more than 10 categories" })
  @ArrayUnique({ message: 'Categories must be unique' })
  @IsString({ each: true, message: 'Each category must be a string' })
  @MaxLength(50, { each: true, message: "Categories can't be longer than 50 characters" })
  categories?: string[];

  @IsString()
  markdown: string;
}

export class UpdateAdminBlogPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: "Title can't be longer than 150 characters" })
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: "Subtitle can't be longer than 300 characters" })
  subtitle?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BlogAuthorDto)
  author?: BlogAuthorDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: "You can't add more than 10 categories" })
  @ArrayUnique({ message: 'Categories must be unique' })
  @IsString({ each: true, message: 'Each category must be a string' })
  @MaxLength(50, { each: true, message: "Categories can't be longer than 50 characters" })
  categories?: string[];

  @IsOptional()
  @IsString()
  markdown?: string;
}
