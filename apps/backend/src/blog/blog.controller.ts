import { Controller, Get, Param, Query } from '@nestjs/common';
import { BlogService } from './blog.service';
import { BlogQueryDto } from './dto/blog-query.dto';

@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get()
  async getBlogPosts(@Query() query: BlogQueryDto) {
    return {
      message: 'Blog posts fetched successfully',
      result: await this.blogService.getPublishedBlogPosts(query),
    };
  }

  @Get(':postId')
  async getBlogPostById(@Param('postId') postId: string) {
    return {
      message: 'Blog post fetched successfully',
      result: await this.blogService.getPublishedBlogPostById(postId),
    };
  }
}
