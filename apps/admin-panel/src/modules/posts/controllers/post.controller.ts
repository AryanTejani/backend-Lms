import { Controller, Post, Get, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { PostService } from '@app/content/services/post.service';
import { PostRecord } from '@app/content/repositories/post.repository';
import { ZodValidationPipe } from '@app/shared/pipes/zod-validation.pipe';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { CurrentAdmin, AuthenticatedAdmin } from '../../../decorators/current-admin.decorator';
import { createPostSchema, updatePostSchema, CreatePostInput, UpdatePostInput } from '../schemas/post.schema';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  async create(@Body(new ZodValidationPipe(createPostSchema)) body: CreatePostInput, @CurrentAdmin() admin: AuthenticatedAdmin): Promise<PostRecord> {
    return this.postService.createPost(admin.id, body);
  }

  @Get()
  async findAll(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('published') published?: string,
  ): Promise<{ data: PostRecord[]; total: number; page: number; limit: number }> {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));

    // Instructors only see their own posts
    const authorId = admin.role === 'instructor' ? admin.id : undefined;
    const isPublished = published === 'true' ? true : published === 'false' ? false : undefined;

    return this.postService.listPosts({ page: pageNum, limit: limitNum, authorId, isPublished });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin): Promise<PostRecord> {
    const post = await this.postService.getPost(id);

    if (admin.role === 'instructor' && post.author_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    return post;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePostSchema)) body: UpdatePostInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<PostRecord> {
    return this.postService.updatePost(id, admin, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin): Promise<{ success: boolean }> {
    await this.postService.deletePost(id, admin);

    return { success: true };
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin): Promise<PostRecord> {
    return this.postService.publishPost(id, admin);
  }

  @Post(':id/unpublish')
  async unpublish(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin): Promise<PostRecord> {
    return this.postService.unpublishPost(id, admin);
  }
}
