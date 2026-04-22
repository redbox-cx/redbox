import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BlogPostStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { SaveAdminBlogPostDto, UpdateAdminBlogPostDto, AdminBlogQueryDto } from 'src/admin/dto/blog.dto';
import { createRequiredS3Client, requireBucket } from 'src/common/storage/s3-client';
import { PrismaService } from 'src/prisma.service';
import { BlogQueryDto } from './dto/blog-query.dto';

type BlogPostRecord = {
  id: string;
  title: string | null;
  subtitle: string;
  categories: Prisma.JsonValue | null;
  storageName: string;
  contentSize: number;
  status: BlogPostStatus;
  authorName: string;
  authorTitle: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  withdrawnAt: Date | null;
};

type NormalizedBlogInput = {
  title?: string | null;
  subtitle: string;
  authorName: string;
  authorTitle: string | null;
  categories: string[];
  markdown: string;
  contentSize: number;
};

@Injectable()
export class BlogService {
  private readonly s3: S3Client;
  private readonly bucket = requireBucket('S3_BUCKET_BLOGS');

  constructor(private readonly prismaService: PrismaService) {
    this.s3 = createRequiredS3Client();
  }

  async getAdminBlogPosts(query: AdminBlogQueryDto) {
    const where = this.buildBlogWhere(query);
    const [posts, total] = await Promise.all([
      this.prismaService.blogPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prismaService.blogPost.count({ where }),
    ]);

    return {
      items: posts.map((post) => this.toMetaRecord(post)),
      pagination: {
        limit: query.limit,
        offset: query.offset,
        returned: posts.length,
        hasMore: query.offset + posts.length < total,
        total,
      },
    };
  }

  async getAdminBlogPostById(postId: string) {
    const post = await this.findBlogPostOrThrow(postId);
    return this.toDetailRecord(post);
  }

  async createAdminBlogPost(
    adminUserId: string,
    dto: SaveAdminBlogPostDto,
    status: BlogPostStatus,
  ) {
    const input = this.normalizeCreateInput(dto);
    const storageName = this.createMarkdownStorageName();

    await this.putMarkdownObject(storageName, input.markdown);

    try {
      const now = new Date();
      const post = await this.prismaService.blogPost.create({
        data: {
          title: input.title,
          subtitle: input.subtitle,
          categories: input.categories,
          storageName,
          contentSize: input.contentSize,
          status,
          authorAdminUserId: adminUserId,
          authorName: input.authorName,
          authorTitle: input.authorTitle,
          publishedAt: status === BlogPostStatus.PUBLISHED ? now : null,
        },
      });

      return {
        success: true,
        message:
          status === BlogPostStatus.PUBLISHED
            ? 'Blog post published successfully'
            : 'Blog post saved as draft successfully',
        postId: post.id,
        storageName: post.storageName,
        status: this.toApiStatus(post.status),
      };
    } catch (error) {
      await this.deleteMarkdownObject(storageName, true);
      throw error;
    }
  }

  async updateAdminBlogPost(postId: string, dto: UpdateAdminBlogPostDto) {
    const post = await this.findBlogPostOrThrow(postId);
    const input = this.normalizeUpdateInput(dto, post);

    if (dto.markdown !== undefined) {
      await this.replaceMarkdownObject(post.storageName, input.markdown);
    }

    await this.prismaService.blogPost.update({
      where: { id: post.id },
      data: {
        title: dto.title === undefined ? undefined : input.title,
        subtitle: dto.subtitle === undefined ? undefined : input.subtitle,
        categories: dto.categories === undefined ? undefined : input.categories,
        authorName: dto.author === undefined ? undefined : input.authorName,
        authorTitle: dto.author === undefined ? undefined : input.authorTitle,
        contentSize: dto.markdown === undefined ? undefined : input.contentSize,
      },
    });

    return {
      success: true,
      message: 'Blog post updated successfully',
      postId: post.id,
      storageName: post.storageName,
    };
  }

  async publishAdminBlogPost(postId: string) {
    const post = await this.findBlogPostOrThrow(postId);

    if (post.status === BlogPostStatus.PUBLISHED) {
      return {
        success: true,
        message: 'Blog post is already published',
        postId: post.id,
        status: this.toApiStatus(post.status),
      };
    }

    const publishedAt = new Date();
    await this.prismaService.blogPost.update({
      where: { id: post.id },
      data: {
        status: BlogPostStatus.PUBLISHED,
        publishedAt,
        withdrawnAt: null,
      },
    });

    return {
      success: true,
      message: 'Blog post published successfully',
      postId: post.id,
      status: 'published',
    };
  }

  async withdrawAdminBlogPost(postId: string) {
    const post = await this.findBlogPostOrThrow(postId);

    if (post.status !== BlogPostStatus.PUBLISHED) {
      throw new BadRequestException('Only published posts can be withdrawn');
    }

    await this.prismaService.blogPost.update({
      where: { id: post.id },
      data: {
        status: BlogPostStatus.WITHDRAWN,
        withdrawnAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Blog post withdrawn successfully',
      postId: post.id,
      status: 'withdrawn',
    };
  }

  async deleteAdminBlogPost(postId: string) {
    const post = await this.findBlogPostOrThrow(postId);

    if (post.status === BlogPostStatus.PUBLISHED) {
      throw new BadRequestException('Published posts must be withdrawn before deletion');
    }

    await this.deleteMarkdownObject(post.storageName);
    await this.prismaService.blogPost.delete({
      where: { id: post.id },
    });

    return {
      success: true,
      message: 'Blog post deleted successfully',
      postId: post.id,
      storageName: post.storageName,
    };
  }

  async getPublishedBlogPosts(query: BlogQueryDto) {
    const where: Prisma.BlogPostWhereInput = {
      status: BlogPostStatus.PUBLISHED,
      publishedAt: { not: null },
    };

    if (query.search) {
      const searchValue = query.search.trim();
      where.OR = [
        { title: { contains: searchValue } },
        { subtitle: { contains: searchValue } },
        { authorName: { contains: searchValue } },
      ];
    }

    const [posts, total] = await Promise.all([
      this.prismaService.blogPost.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: query.limit,
        skip: query.offset,
      }),
      this.prismaService.blogPost.count({ where }),
    ]);

    return {
      items: posts.map((post) => this.toMetaRecord(post)),
      pagination: {
        limit: query.limit,
        offset: query.offset,
        returned: posts.length,
        hasMore: query.offset + posts.length < total,
        total,
      },
    };
  }

  async getPublishedBlogPostById(postId: string) {
    const post = await this.prismaService.blogPost.findFirst({
      where: {
        id: postId,
        status: BlogPostStatus.PUBLISHED,
        publishedAt: { not: null },
      },
    });

    if (!post) {
      throw new NotFoundException('Blog post not found');
    }

    return this.toDetailRecord(post);
  }

  private buildBlogWhere(query: AdminBlogQueryDto): Prisma.BlogPostWhereInput {
    const where: Prisma.BlogPostWhereInput = {};

    if (query.status) {
      where.status = this.toPrismaStatus(query.status);
    }

    if (query.search) {
      const searchValue = query.search.trim();
      where.OR = [
        { title: { contains: searchValue } },
        { subtitle: { contains: searchValue } },
        { authorName: { contains: searchValue } },
      ];
    }

    return where;
  }

  private async findBlogPostOrThrow(postId: string) {
    const post = await this.prismaService.blogPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Blog post not found');
    }

    return post;
  }

  private normalizeCreateInput(dto: SaveAdminBlogPostDto): NormalizedBlogInput {
    const markdown = this.normalizeMarkdown(dto.markdown);

    return {
      title: this.normalizeOptionalString(dto.title),
      subtitle: this.normalizeRequiredString(dto.subtitle, 'Subtitle'),
      authorName: this.normalizeRequiredString(dto.author.name, 'Author name'),
      authorTitle: this.normalizeOptionalString(dto.author.title),
      categories: this.normalizeCategories(dto.categories),
      markdown,
      contentSize: Buffer.byteLength(markdown, 'utf8'),
    };
  }

  private normalizeUpdateInput(
    dto: UpdateAdminBlogPostDto,
    existingPost: BlogPostRecord,
  ): NormalizedBlogInput {
    const markdown =
      dto.markdown === undefined ? '' : this.normalizeMarkdown(dto.markdown);

    return {
      title:
        dto.title === undefined
          ? existingPost.title
          : this.normalizeOptionalString(dto.title),
      subtitle:
        dto.subtitle === undefined
          ? existingPost.subtitle
          : this.normalizeRequiredString(dto.subtitle, 'Subtitle'),
      authorName:
        dto.author?.name === undefined
          ? existingPost.authorName
          : this.normalizeRequiredString(dto.author.name, 'Author name'),
      authorTitle:
        dto.author === undefined
          ? existingPost.authorTitle
          : this.normalizeOptionalString(dto.author.title),
      categories:
        dto.categories === undefined
          ? this.toCategories(existingPost.categories)
          : this.normalizeCategories(dto.categories),
      markdown,
      contentSize:
        dto.markdown === undefined
          ? existingPost.contentSize
          : Buffer.byteLength(markdown, 'utf8'),
    };
  }

  private normalizeMarkdown(markdown: string) {
    if (!markdown || markdown.trim().length === 0) {
      throw new BadRequestException("Markdown content can't be empty");
    }

    return markdown;
  }

  private normalizeRequiredString(value: string, label: string) {
    const normalizedValue = value?.trim();
    if (!normalizedValue) {
      throw new BadRequestException(`${label} can't be empty`);
    }

    return normalizedValue;
  }

  private normalizeOptionalString(value?: string | null) {
    const normalizedValue = value?.trim();
    return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null;
  }

  private normalizeCategories(categories: string[] | undefined) {
    const normalizedCategories = [...new Set(
      (categories ?? [])
        .map((category) => category.trim())
        .filter(Boolean),
    )];

    if (normalizedCategories.length > 10) {
      throw new BadRequestException("You can't add more than 10 categories");
    }

    const tooLongCategory = normalizedCategories.find((category) => category.length > 50);
    if (tooLongCategory) {
      throw new BadRequestException("Categories can't be longer than 50 characters");
    }

    return normalizedCategories;
  }

  private toMetaRecord(post: BlogPostRecord) {
    return {
      postId: post.id,
      id: post.id,
      title: post.title,
      subtitle: post.subtitle,
      author: {
        name: post.authorName,
        title: post.authorTitle,
      },
      timestamp: post.createdAt.toISOString(),
      status: this.toApiStatus(post.status),
      storageName: post.storageName,
      contentSize: post.contentSize,
      categories: this.toCategories(post.categories),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      publishedAt: post.publishedAt?.toISOString() ?? null,
      withdrawnAt: post.withdrawnAt?.toISOString() ?? null,
    };
  }

  private async toDetailRecord(post: BlogPostRecord) {
    return {
      ...this.toMetaRecord(post),
      markdown: await this.getMarkdownObject(post.storageName),
    };
  }

  private toCategories(categories: Prisma.JsonValue | null) {
    if (!Array.isArray(categories)) {
      return [];
    }

    return categories.filter((category): category is string => typeof category === 'string');
  }

  private toPrismaStatus(status: 'draft' | 'published' | 'withdrawn') {
    if (status === 'published') {
      return BlogPostStatus.PUBLISHED;
    }

    if (status === 'withdrawn') {
      return BlogPostStatus.WITHDRAWN;
    }

    return BlogPostStatus.DRAFT;
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

  private createMarkdownStorageName() {
    return `${randomUUID()}.md`;
  }

  private getMarkdownStorageKey(storageName: string) {
    return `blog_posts/${storageName}`;
  }

  private async putMarkdownObject(storageName: string, markdown: string) {
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: this.getMarkdownStorageKey(storageName),
      Body: Buffer.from(markdown, 'utf8'),
      ContentType: 'text/markdown; charset=utf-8',
    }));
  }

  private async replaceMarkdownObject(storageName: string, markdown: string) {
    await this.putMarkdownObject(storageName, markdown);
  }

  private async getMarkdownObject(storageName: string) {
    const response = await this.s3.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.getMarkdownStorageKey(storageName),
    }));

    return Buffer.from(await response.Body!.transformToByteArray()).toString('utf8');
  }

  private async deleteMarkdownObject(storageName: string, ignoreErrors = false) {
    try {
      await this.s3.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.getMarkdownStorageKey(storageName),
      }));
    } catch (error) {
      if (!ignoreErrors) {
        throw error;
      }
    }
  }
}
