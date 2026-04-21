import { Module } from '@nestjs/common';
import { BlogService } from 'src/blog/blog.service';
import { AdminBlogController } from './admin-blog.controller';
import { AdminBlogService } from './admin-blog.service';

@Module({
  controllers: [AdminBlogController],
  providers: [AdminBlogService, BlogService],
})
export class AdminBlogModule {}
