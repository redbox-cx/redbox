import { Module } from '@nestjs/common';
import { AdminBlogController } from './admin-blog.controller';
import { AdminBlogService } from './admin-blog.service';

@Module({
  controllers: [AdminBlogController],
  providers: [AdminBlogService],
})
export class AdminBlogModule {}
