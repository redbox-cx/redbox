import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
import { AdminDefaultRateLimit, RateLimit } from 'src/common/rate-limit/rate-limit.decorators';
import { RateLimitGuard } from 'src/common/rate-limit/rate-limit.guard';
import { AdminBlogQueryDto, SaveAdminBlogPostDto, UpdateAdminBlogPostDto } from '../dto/blog.dto';
import { AdminJwtAuthGuard } from '../guard/admin-auth.guard';
import { AdminBlogService } from './admin-blog.service';

@Controller('admin')
@AdminDefaultRateLimit()
@UseGuards(AdminJwtAuthGuard, RateLimitGuard)
export class AdminBlogController {
  constructor(private readonly adminBlogService: AdminBlogService) {}

  @Get('blog')
  async getBlogPosts(@Query() query: AdminBlogQueryDto) {
    return {
      message: 'Blog posts fetched successfully',
      result: await this.adminBlogService.getBlogPosts(query),
    };
  }

  @Get('blog/:postId')
  async getBlogPost(@Param('postId') postId: string) {
    return {
      message: 'Blog post fetched successfully',
      result: await this.adminBlogService.getBlogPost(postId),
    };
  }

  @Post('blog')
  async saveBlogDraft(@GetUserId() adminUserId: string, @Body() dto: SaveAdminBlogPostDto) {
    const result = await this.adminBlogService.createDraft(adminUserId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Post('blog/draft')
  async createBlogDraft(@GetUserId() adminUserId: string, @Body() dto: SaveAdminBlogPostDto) {
    const result = await this.adminBlogService.createDraft(adminUserId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Post('blog/publish')
  async createAndPublishBlogPost(
    @GetUserId() adminUserId: string,
    @Body() dto: SaveAdminBlogPostDto,
  ) {
    const result = await this.adminBlogService.createPublished(adminUserId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Post('blog/:postId/publish')
  async publishBlogPost(@GetUserId() adminUserId: string, @Param('postId') postId: string) {
    const result = await this.adminBlogService.publishBlogPost(adminUserId, postId);
    return {
      message: result.message,
      result,
    };
  }

  @Post('blog/:postId/withdraw')
  async withdrawBlogPost(@GetUserId() adminUserId: string, @Param('postId') postId: string) {
    const result = await this.adminBlogService.withdrawBlogPost(adminUserId, postId);
    return {
      message: result.message,
      result,
    };
  }

  @Post('blog/:postId')
  async repostBlogPost(
    @GetUserId() adminUserId: string,
    @Param('postId') postId: string,
    @Body() dto: UpdateAdminBlogPostDto,
  ) {
    const result = await this.adminBlogService.updateBlogPost(adminUserId, postId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Patch('blog/:postId')
  async updateBlogPost(
    @GetUserId() adminUserId: string,
    @Param('postId') postId: string,
    @Body() dto: UpdateAdminBlogPostDto,
  ) {
    const result = await this.adminBlogService.updateBlogPost(adminUserId, postId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Delete('blog/:postId')
  @RateLimit({ name: 'admin:danger:admin', limit: 10, windowSeconds: 10 * 60, subject: 'admin' })
  async deleteBlogPost(@GetUserId() adminUserId: string, @Param('postId') postId: string) {
    const result = await this.adminBlogService.deleteBlogPost(adminUserId, postId);
    return {
      message: result.message,
      result,
    };
  }
}
