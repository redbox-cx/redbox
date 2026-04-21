import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, BlogPostStatus, Prisma } from '@prisma/client';
import { BlogService } from 'src/blog/blog.service';
import { PrismaService } from 'src/prisma.service';
import { AdminBlogQueryDto, SaveAdminBlogPostDto, UpdateAdminBlogPostDto } from '../dto/blog.dto';

@Injectable()
export class AdminBlogService {
  constructor(
    private readonly blogService: BlogService,
    private readonly prismaService: PrismaService,
  ) {}

  getBlogPosts(query: AdminBlogQueryDto) {
    return this.blogService.getAdminBlogPosts(query);
  }

  getBlogPost(postId: string) {
    return this.blogService.getAdminBlogPostById(postId);
  }

  async createDraft(adminUserId: string, dto: SaveAdminBlogPostDto) {
    const result = await this.blogService.createAdminBlogPost(
      adminUserId,
      dto,
      BlogPostStatus.DRAFT,
    );
    const createdPost = await this.getBlogPostAuditSnapshot(result.postId);

    await this.createAuditLog({
      adminUserId,
      action: 'blog_post_created',
      reason: `Blog post "${createdPost.title ?? createdPost.subtitle}" saved as draft`,
      meta: {
        blogPostId: result.postId,
        post: createdPost,
      },
    });

    return result;
  }

  async createPublished(adminUserId: string, dto: SaveAdminBlogPostDto) {
    const result = await this.blogService.createAdminBlogPost(
      adminUserId,
      dto,
      BlogPostStatus.PUBLISHED,
    );
    const createdPost = await this.getBlogPostAuditSnapshot(result.postId);

    await this.createAuditLog({
      adminUserId,
      action: 'blog_post_published',
      reason: `Blog post "${createdPost.title ?? createdPost.subtitle}" published`,
      meta: {
        blogPostId: result.postId,
        post: createdPost,
        createdAndPublished: true,
      },
    });

    return result;
  }

  async updateBlogPost(adminUserId: string, postId: string, dto: UpdateAdminBlogPostDto) {
    const before = await this.getBlogPostAuditSnapshot(postId);
    const result = await this.blogService.updateAdminBlogPost(postId, dto);
    const after = await this.getBlogPostAuditSnapshot(postId);

    await this.createAuditLog({
      adminUserId,
      action: 'blog_post_updated',
      reason: `Blog post "${after.title ?? after.subtitle}" updated`,
      meta: {
        blogPostId: postId,
        before,
        after,
        changedFields: Object.keys(dto),
      },
    });

    return result;
  }

  async publishBlogPost(adminUserId: string, postId: string) {
    const before = await this.getBlogPostAuditSnapshot(postId);
    const result = await this.blogService.publishAdminBlogPost(postId);
    const after = await this.getBlogPostAuditSnapshot(postId);

    await this.createAuditLog({
      adminUserId,
      action: 'blog_post_published',
      reason: `Blog post "${after.title ?? after.subtitle}" published`,
      meta: {
        blogPostId: postId,
        before,
        after,
      },
    });

    return result;
  }

  async withdrawBlogPost(adminUserId: string, postId: string) {
    const before = await this.getBlogPostAuditSnapshot(postId);
    const result = await this.blogService.withdrawAdminBlogPost(postId);
    const after = await this.getBlogPostAuditSnapshot(postId);

    await this.createAuditLog({
      adminUserId,
      action: 'blog_post_withdrawn',
      reason: `Blog post "${after.title ?? after.subtitle}" withdrawn`,
      meta: {
        blogPostId: postId,
        before,
        after,
      },
    });

    return result;
  }

  async deleteBlogPost(adminUserId: string, postId: string) {
    const before = await this.getBlogPostAuditSnapshot(postId);
    const result = await this.blogService.deleteAdminBlogPost(postId);

    await this.createAuditLog({
      adminUserId,
      action: 'blog_post_deleted',
      reason: `Blog post "${before.title ?? before.subtitle}" deleted`,
      meta: {
        blogPostId: postId,
        deletedPost: before,
      },
    });

    return result;
  }

  private async getBlogPostAuditSnapshot(postId: string) {
    const post = await this.prismaService.blogPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        subtitle: true,
        categories: true,
        storageName: true,
        contentSize: true,
        status: true,
        authorName: true,
        authorTitle: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
        withdrawnAt: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Blog post not found');
    }

    return {
      id: post.id,
      title: post.title,
      subtitle: post.subtitle,
      categories: this.toCategories(post.categories),
      storageName: post.storageName,
      contentSize: post.contentSize,
      status: this.toApiStatus(post.status),
      author: {
        name: post.authorName,
        title: post.authorTitle,
      },
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      publishedAt: post.publishedAt?.toISOString() ?? null,
      withdrawnAt: post.withdrawnAt?.toISOString() ?? null,
    };
  }

  private toApiStatus(status: BlogPostStatus) {
    if (status === BlogPostStatus.PUBLISHED) {
      return 'published';
    }

    if (status === BlogPostStatus.WITHDRAWN) {
      return 'withdrawn';
    }

    return 'draft';
  }

  private toCategories(categories: Prisma.JsonValue | null) {
    if (!Array.isArray(categories)) {
      return [];
    }

    return categories.filter((category): category is string => typeof category === 'string');
  }

  private async createAuditLog(params: {
    adminUserId: string;
    action: string;
    reason: string;
    meta: Prisma.InputJsonValue;
  }) {
    await this.prismaService.adminAuditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        adminUserId: params.adminUserId,
        action: params.action,
        reason: params.reason,
        meta: params.meta,
      },
    });
  }
}
