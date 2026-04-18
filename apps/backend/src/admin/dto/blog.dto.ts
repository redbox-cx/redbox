import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { OffsetPaginationQueryDto } from './common.dto';

const BLOG_STATUSES = ['draft', 'published'] as const;

export class AdminBlogQueryDto extends OffsetPaginationQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(BLOG_STATUSES, { message: 'Status must be draft or published' })
  status?: 'draft' | 'published';

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "Search can't be longer than 100 characters" })
  search?: string;
}

export class CreateAdminBlogPostDto {
  @IsString()
  @MaxLength(150, { message: "Title can't be longer than 150 characters" })
  title: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase and may contain hyphens',
  })
  slug: string;

  @IsString()
  @MaxLength(300, { message: "Excerpt can't be longer than 300 characters" })
  excerpt: string;

  @IsString()
  content: string;

  @IsBoolean()
  isHtml: boolean;

  @IsString()
  @IsIn(BLOG_STATUSES, { message: 'Status must be draft or published' })
  status: 'draft' | 'published';
}

export class UpdateAdminBlogPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: "Title can't be longer than 150 characters" })
  title?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase and may contain hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: "Excerpt can't be longer than 300 characters" })
  excerpt?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  isHtml?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(BLOG_STATUSES, { message: 'Status must be draft or published' })
  status?: 'draft' | 'published';
}