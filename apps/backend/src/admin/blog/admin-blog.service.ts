import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ADMIN_BLOG_POSTS, type AdminBlogPostRecord } from '../admin.data';
import { AdminBlogQueryDto, CreateAdminBlogPostDto, UpdateAdminBlogPostDto } from '../dto/blog.dto';

function clone<T>(value: T): T {
  return structuredClone(value);
}

@Injectable()
export class AdminBlogService {
  private readonly adminProfile = {
    username: 'Admin',
  };

  private blogPosts: AdminBlogPostRecord[] = clone(ADMIN_BLOG_POSTS);

  getBlogPosts(query: AdminBlogQueryDto) {
    let items = [...this.blogPosts];

    if (query.status) {
      items = items.filter((post) => post.status === query.status);
    }

    if (query.search) {
      const searchValue = query.search.toLowerCase();
      items = items.filter(
        (post) =>
          post.title.toLowerCase().includes(searchValue) ||
          post.slug.toLowerCase().includes(searchValue) ||
          post.excerpt.toLowerCase().includes(searchValue),
      );
    }

    const paginatedItems = items.slice(query.offset, query.offset + query.limit);

    return {
      items: clone(paginatedItems),
      pagination: {
        limit: query.limit,
        offset: query.offset,
        returned: paginatedItems.length,
        hasMore: query.offset + paginatedItems.length < items.length,
      },
    };
  }

  createBlogPost(dto: CreateAdminBlogPostDto) {
    if (this.blogPosts.some((post) => post.slug === dto.slug)) {
      throw new BadRequestException('Slug already exists');
    }

    const now = new Date().toISOString();
    const postId = `post_${Date.now()}`;
    this.blogPosts.unshift({
      id: postId,
      title: dto.title,
      slug: dto.slug,
      excerpt: dto.excerpt,
      content: dto.content,
      isHtml: dto.isHtml,
      status: dto.status,
      author: this.adminProfile.username,
      createdAt: now,
      updatedAt: now,
      publishedAt: dto.status === 'published' ? now : null,
    });

    return {
      success: true,
      message: 'Blog post created successfully',
      postId,
    };
  }

  updateBlogPost(postId: string, dto: UpdateAdminBlogPostDto) {
    const post = this.findBlogPostOrThrow(postId);

    if (dto.slug && dto.slug !== post.slug && this.blogPosts.some((entry) => entry.slug === dto.slug)) {
      throw new BadRequestException('Slug already exists');
    }

    post.title = dto.title ?? post.title;
    post.slug = dto.slug ?? post.slug;
    post.excerpt = dto.excerpt ?? post.excerpt;
    post.content = dto.content ?? post.content;
    post.isHtml = dto.isHtml ?? post.isHtml;
    post.status = dto.status ?? post.status;
    post.updatedAt = new Date().toISOString();

    if (post.status === 'published' && !post.publishedAt) {
      post.publishedAt = post.updatedAt;
    }

    return {
      success: true,
      message: 'Blog post updated successfully',
    };
  }

  deleteBlogPost(postId: string) {
    this.findBlogPostOrThrow(postId);
    this.blogPosts = this.blogPosts.filter((entry) => entry.id !== postId);

    return {
      success: true,
      message: 'Blog post deleted successfully',
    };
  }

  private findBlogPostOrThrow(postId: string) {
    const post = this.blogPosts.find((entry) => entry.id === postId);
    if (!post) {
      throw new NotFoundException('Blog post not found');
    }

    return post;
  }
}
