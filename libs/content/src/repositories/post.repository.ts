import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { generateUuidV7 } from '@app/shared/utils/uuid.util';

export interface PostRecord {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  author_id: string;
  subscription_plan_id: string | null;
  is_published: boolean;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  author?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
  categories: Array<{ id: string; name: string; slug: string }>;
  tags: Array<{ id: string; name: string; slug: string }>;
}

@Injectable()
export class PostRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: {
    title: string;
    slug: string;
    content: string;
    excerpt?: string | undefined;
    coverImageUrl?: string | undefined;
    authorId: string;
    subscriptionPlanId?: string | undefined;
    categoryIds?: string[];
    tagIds?: string[];
  }): Promise<PostRecord> {
    const id = generateUuidV7();
    const post = await this.prisma.post.create({
      data: {
        id,
        title: params.title,
        slug: params.slug,
        content: params.content,
        excerpt: params.excerpt ?? null,
        coverImageUrl: params.coverImageUrl ?? null,
        authorId: params.authorId,
        subscriptionPlanId: params.subscriptionPlanId ?? null,
        ...(params.categoryIds?.length && {
          categories: { create: params.categoryIds.map((cid) => ({ categoryId: cid })) },
        }),
        ...(params.tagIds?.length && {
          tags: { create: params.tagIds.map((tid) => ({ tagId: tid })) },
        }),
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, email: true } },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
    });

    return this.mapToPostRecord(post);
  }

  async findById(id: string): Promise<PostRecord | null> {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, email: true } },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
    });

    if (!post || post.deletedAt !== null) {
      return null;
    }

    return this.mapToPostRecord(post);
  }

  async findBySlug(slug: string): Promise<PostRecord | null> {
    const post = await this.prisma.post.findUnique({
      where: { slug },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, email: true } },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
    });

    if (!post || post.deletedAt !== null) {
      return null;
    }

    return this.mapToPostRecord(post);
  }

  async findAll(params: {
    page: number;
    limit: number;
    authorId?: string | undefined;
    isPublished?: boolean | undefined;
  }): Promise<{ data: PostRecord[]; total: number }> {
    const skip = (params.page - 1) * params.limit;
    const where: Record<string, unknown> = { deletedAt: null };

    if (params.authorId) {
      where.authorId = params.authorId;
    }

    if (params.isPublished !== undefined) {
      where.isPublished = params.isPublished;
    }

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, firstName: true, lastName: true, email: true } },
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      data: posts.map((p) => this.mapToPostRecord(p)),
      total,
    };
  }

  async update(
    id: string,
    data: {
      title?: string | undefined;
      slug?: string | undefined;
      content?: string | undefined;
      excerpt?: string | null | undefined;
      coverImageUrl?: string | null | undefined;
      subscriptionPlanId?: string | null | undefined;
      categoryIds?: string[];
      tagIds?: string[];
    },
  ): Promise<PostRecord> {
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) {
      updateData.title = data.title;
    }

    if (data.slug !== undefined) {
      updateData.slug = data.slug;
    }

    if (data.content !== undefined) {
      updateData.content = data.content;
    }

    if (data.excerpt !== undefined) {
      updateData.excerpt = data.excerpt;
    }

    if (data.coverImageUrl !== undefined) {
      updateData.coverImageUrl = data.coverImageUrl;
    }

    if (data.subscriptionPlanId !== undefined) {
      updateData.subscriptionPlanId = data.subscriptionPlanId;
    }

    if (data.categoryIds !== undefined) {
      updateData.categories = {
        deleteMany: {},
        create: data.categoryIds.map((cid) => ({ categoryId: cid })),
      };
    }

    if (data.tagIds !== undefined) {
      updateData.tags = {
        deleteMany: {},
        create: data.tagIds.map((tid) => ({ tagId: tid })),
      };
    }

    const post = await this.prisma.post.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: { id: true, firstName: true, lastName: true, email: true } },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
    });

    return this.mapToPostRecord(post);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.post.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async publish(id: string): Promise<PostRecord> {
    const post = await this.prisma.post.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date() },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, email: true } },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
    });

    return this.mapToPostRecord(post);
  }

  async unpublish(id: string): Promise<PostRecord> {
    const post = await this.prisma.post.update({
      where: { id },
      data: { isPublished: false, publishedAt: null },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, email: true } },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
    });

    return this.mapToPostRecord(post);
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const post = await this.prisma.post.findUnique({ where: { slug } });

    if (!post) {
      return false;
    }

    if (excludeId && post.id === excludeId) {
      return false;
    }

    return true;
  }

  private mapToPostRecord(post: {
    id: string;
    title: string;
    slug: string;
    content: string;
    excerpt: string | null;
    coverImageUrl: string | null;
    authorId: string;
    subscriptionPlanId: string | null;
    isPublished: boolean;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    author?: { id: string; firstName: string | null; lastName: string | null; email: string };
    categories?: Array<{ category: { id: string; name: string; slug: string } }>;
    tags?: Array<{ tag: { id: string; name: string; slug: string } }>;
  }): PostRecord {
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt,
      cover_image_url: post.coverImageUrl,
      author_id: post.authorId,
      subscription_plan_id: post.subscriptionPlanId,
      is_published: post.isPublished,
      published_at: post.publishedAt,
      created_at: post.createdAt,
      updated_at: post.updatedAt,
      deleted_at: post.deletedAt,
      ...(post.author && {
        author: {
          id: post.author.id,
          first_name: post.author.firstName,
          last_name: post.author.lastName,
          email: post.author.email,
        },
      }),
      categories: (post.categories ?? []).map((pc) => ({
        id: pc.category.id,
        name: pc.category.name,
        slug: pc.category.slug,
      })),
      tags: (post.tags ?? []).map((pt) => ({
        id: pt.tag.id,
        name: pt.tag.name,
        slug: pt.tag.slug,
      })),
    };
  }
}
