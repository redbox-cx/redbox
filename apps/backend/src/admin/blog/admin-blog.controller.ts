import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../guard/admin-auth.guard';
import { AdminBlogQueryDto, CreateAdminBlogPostDto, UpdateAdminBlogPostDto } from '../dto/blog.dto';
import { AdminBlogService } from './admin-blog.service';

@Controller('admin')
@UseGuards(AdminJwtAuthGuard)
export class AdminBlogController {
  constructor(private readonly adminBlogService: AdminBlogService) {}

  @Get('blog')
  getBlogPosts(@Query() query: AdminBlogQueryDto) {
    return {
      message: 'Blog posts fetched successfully',
      result: this.adminBlogService.getBlogPosts(query),
    };
  }

  @Post('blog')
  createBlogPost(@Body() dto: CreateAdminBlogPostDto) {
    const result = this.adminBlogService.createBlogPost(dto);
    return {
      message: result.message,
      result,
    };
  }

  @Patch('blog/:postId')
  updateBlogPost(@Param('postId') postId: string, @Body() dto: UpdateAdminBlogPostDto) {
    const result = this.adminBlogService.updateBlogPost(postId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Delete('blog/:postId')
  deleteBlogPost(@Param('postId') postId: string) {
    const result = this.adminBlogService.deleteBlogPost(postId);
    return {
      message: result.message,
      result,
    };
  }
}
