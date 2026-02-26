import { Injectable } from '@nestjs/common';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { PostRepository, PostRecord } from '../repositories/post.repository';

@Injectable()
export class PostService {
  constructor(private readonly postRepository: PostRepository) {}

  async createPost(
    authorId: string,
    input: {
      title: string;
      content: string;
      excerpt?: string | undefined;
      coverImageUrl?: string | undefined;
      subscriptionPlanId?: string | undefined;
      categoryIds?: string[] | undefined;
      tagIds?: string[] | undefined;
    },
  ): Promise<PostRecord> {
    const slug = await this.generateUniqueSlug(input.title);

    return this.postRepository.create({
      title: input.title,
      slug,
      content: input.content,
      excerpt: input.excerpt,
      coverImageUrl: input.coverImageUrl,
      authorId,
      subscriptionPlanId: input.subscriptionPlanId,
      ...(input.categoryIds && { categoryIds: input.categoryIds }),
      ...(input.tagIds && { tagIds: input.tagIds }),
    });
  }

  async updatePost(
    postId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    input: {
      title?: string | undefined;
      content?: string | undefined;
      excerpt?: string | null | undefined;
      coverImageUrl?: string | null | undefined;
      subscriptionPlanId?: string | null | undefined;
      categoryIds?: string[] | undefined;
      tagIds?: string[] | undefined;
    },
  ): Promise<PostRecord> {
    const post = await this.postRepository.findById(postId);

    if (!post) {
      throw Errors.postNotFound();
    }

    // Instructors can only edit their own posts
    if (admin.role === 'instructor' && post.author_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    const updateData: Record<string, unknown> = {};

    if (input.title !== undefined) {
      updateData.title = input.title;
      updateData.slug = await this.generateUniqueSlug(input.title, postId);
    }

    if (input.content !== undefined) {
      updateData.content = input.content;
    }

    if (input.excerpt !== undefined) {
      updateData.excerpt = input.excerpt;
    }

    if (input.coverImageUrl !== undefined) {
      updateData.coverImageUrl = input.coverImageUrl;
    }

    if (input.subscriptionPlanId !== undefined) {
      updateData.subscriptionPlanId = input.subscriptionPlanId;
    }

    if (input.categoryIds !== undefined) {
      updateData.categoryIds = input.categoryIds;
    }

    if (input.tagIds !== undefined) {
      updateData.tagIds = input.tagIds;
    }

    return this.postRepository.update(
      postId,
      updateData as {
        title?: string;
        slug?: string;
        content?: string;
        excerpt?: string | null;
        coverImageUrl?: string | null;
        subscriptionPlanId?: string | null;
        categoryIds?: string[];
        tagIds?: string[];
      },
    );
  }

  async deletePost(postId: string, admin: { id: string; role: 'admin' | 'instructor' }): Promise<void> {
    const post = await this.postRepository.findById(postId);

    if (!post) {
      throw Errors.postNotFound();
    }

    if (admin.role === 'instructor' && post.author_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    await this.postRepository.softDelete(postId);
  }

  async getPost(id: string): Promise<PostRecord> {
    const post = await this.postRepository.findById(id);

    if (!post) {
      throw Errors.postNotFound();
    }

    return post;
  }

  async listPosts(params: {
    page: number;
    limit: number;
    authorId?: string | undefined;
    isPublished?: boolean | undefined;
  }): Promise<{ data: PostRecord[]; total: number; page: number; limit: number }> {
    const result = await this.postRepository.findAll(params);

    return { ...result, page: params.page, limit: params.limit };
  }

  async publishPost(postId: string, admin: { id: string; role: 'admin' | 'instructor' }): Promise<PostRecord> {
    const post = await this.postRepository.findById(postId);

    if (!post) {
      throw Errors.postNotFound();
    }

    if (admin.role === 'instructor' && post.author_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    return this.postRepository.publish(postId);
  }

  async unpublishPost(postId: string, admin: { id: string; role: 'admin' | 'instructor' }): Promise<PostRecord> {
    const post = await this.postRepository.findById(postId);

    if (!post) {
      throw Errors.postNotFound();
    }

    if (admin.role === 'instructor' && post.author_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    return this.postRepository.unpublish(postId);
  }

  private async generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    let counter = 1;
    const maxIterations = 100;

    while (await this.postRepository.slugExists(slug, excludeId)) {
      if (counter >= maxIterations) {
        const suffix = Math.random().toString(36).slice(2, 8);

        slug = `${baseSlug}-${suffix}`;
        break;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}
