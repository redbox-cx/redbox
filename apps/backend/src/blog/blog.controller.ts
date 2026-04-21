import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { BlogService } from './blog.service';
import { BlogQueryDto } from './dto/blog-query.dto';
import { RateLimit } from 'src/common/rate-limit/rate-limit.decorators';
import { RateLimitGuard } from 'src/common/rate-limit/rate-limit.guard';

@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get()
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'blog:list:ip', limit: 300, windowSeconds: 60, subject: 'ip' })
  async getBlogPosts(@Query() query: BlogQueryDto) {
    return {
      message: 'Blog posts fetched successfully',
      result: await this.blogService.getPublishedBlogPosts(query),
    };
  }

  @Get(':postId')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'blog:detail:ip', limit: 300, windowSeconds: 60, subject: 'ip' })
  async getBlogPostById(@Param('postId') postId: string) {
    return {
      message: 'Blog post fetched successfully',
      result: await this.blogService.getPublishedBlogPostById(postId),
    };
  }
}
