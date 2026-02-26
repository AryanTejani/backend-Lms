import { Controller, Get, Post, Patch, Put, Delete, Param, Query, Body, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VideoService, ZodValidationPipe } from '@app/shared';
import type { BunnyVideo, BunnyStatusResponse, BunnyStreamLibrary } from '@app/shared';
import { VideoContentService } from '@app/content/services/video-content.service';
import type { VideoRecord } from '@app/content/repositories/video.repository';
import type { Express } from 'express';
import { CurrentAdmin, AuthenticatedAdmin } from '../../decorators/current-admin.decorator';
import { createVideoSchema, updateVideoSchema, fetchVideoSchema, addCaptionSchema, setThumbnailUrlSchema, syncVideosSchema } from './schemas/video.schema';
import type { CreateVideoInput, UpdateVideoInput, FetchVideoInput, AddCaptionInput, SetThumbnailUrlInput, SyncVideosInput } from './schemas/video.schema';

@Controller('videos')
export class VideoController {
  constructor(
    private readonly videoContentService: VideoContentService,
    private readonly videoService: VideoService,
  ) {}

  @Get()
  async list(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category_id') categoryId?: string,
    @Query('published') published?: string,
  ): Promise<{ data: VideoRecord[]; total: number; page: number; limit: number }> {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));

    // Instructors only see their own videos
    const instructorId = admin.role === 'instructor' ? admin.id : undefined;
    const isPublished = published === 'true' ? true : published === 'false' ? false : undefined;

    return this.videoContentService.listVideos({
      page: pageNum,
      limit: limitNum,
      instructorId,
      categoryId,
      isPublished,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin): Promise<VideoRecord & { embed_url: string }> {
    const video = await this.videoContentService.getVideo(id);

    if (admin.role === 'instructor' && video.instructor_id !== admin.id) {
      const { Errors } = await import('@app/shared/exceptions/auth.exception');

      throw Errors.insufficientRole();
    }

    const embedUrl = this.videoService.getEmbedUrl(
      video.bunny_video_id,
      video.bunny_library_type as BunnyStreamLibrary,
    );

    return { ...video, embed_url: embedUrl };
  }

  @Post('sync')
  async syncFromBunny(
    @Body(new ZodValidationPipe(syncVideosSchema)) body: SyncVideosInput,
  ): Promise<{ synced: number; total_in_bunny: number }> {
    return this.videoContentService.syncVideosFromBunny(body.instructor_id);
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createVideoSchema)) body: CreateVideoInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<VideoRecord> {
    return this.videoContentService.createVideo(admin.id, {
      title: body.title,
      description: body.description,
      categoryId: body.category_id,
    });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateVideoSchema)) body: UpdateVideoInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<VideoRecord> {
    return this.videoContentService.updateVideo(id, admin, {
      title: body.title,
      description: body.description,
      categoryId: body.category_id,
      sortOrder: body.sort_order,
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin): Promise<{ success: boolean }> {
    await this.videoContentService.deleteVideo(id, admin);

    return { success: true };
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin): Promise<VideoRecord> {
    return this.videoContentService.publishVideo(id, admin);
  }

  @Post(':id/unpublish')
  async unpublish(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin): Promise<VideoRecord> {
    return this.videoContentService.unpublishVideo(id, admin);
  }

  // ---- Bunny CDN direct operations (upload, reencode, thumbnail, fetch, captions) ----

  @Put(':id/upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('enabledResolutions') enabledResolutions?: string,
  ): Promise<BunnyStatusResponse> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Get the video to find bunny_video_id and library type
    const video = await this.videoContentService.getVideo(id);
    const library = video.bunny_library_type as BunnyStreamLibrary;

    return this.videoService.uploadVideo(video.bunny_video_id, file.buffer, enabledResolutions ? { enabledResolutions } : undefined, library);
  }

  @Post(':id/reencode')
  async reencode(@Param('id') id: string): Promise<BunnyVideo> {
    const video = await this.videoContentService.getVideo(id);

    return this.videoService.reencodeVideo(video.bunny_video_id, video.bunny_library_type as BunnyStreamLibrary);
  }

  @Post(':id/thumbnail')
  @UseInterceptors(FileInterceptor('file'))
  async setThumbnail(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: SetThumbnailUrlInput | Record<string, never>,
  ): Promise<BunnyStatusResponse> {
    const video = await this.videoContentService.getVideo(id);
    const library = video.bunny_library_type as BunnyStreamLibrary;

    if (file) {
      return this.videoService.setThumbnail(video.bunny_video_id, { buffer: file.buffer }, library);
    }

    const parsed = setThumbnailUrlSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException('Provide either a file upload or a thumbnailUrl in the body');
    }

    return this.videoService.setThumbnail(video.bunny_video_id, { thumbnailUrl: parsed.data.thumbnailUrl }, library);
  }

  @Post('fetch')
  async fetchVideo(
    @Body(new ZodValidationPipe(fetchVideoSchema)) body: FetchVideoInput,
    @Query('collectionId') collectionId?: string,
    @Query('thumbnailTime') thumbnailTime?: string,
  ): Promise<BunnyStatusResponse> {
    const query: { collectionId?: string; thumbnailTime?: number } = {};

    if (collectionId) {
      query.collectionId = collectionId;
    }

    if (thumbnailTime) {
      query.thumbnailTime = parseInt(thumbnailTime, 10);
    }

    return this.videoService.fetchVideo(body, Object.keys(query).length > 0 ? query : undefined);
  }

  @Post(':id/captions/:srclang')
  async addCaption(
    @Param('id') id: string,
    @Param('srclang') srclang: string,
    @Body(new ZodValidationPipe(addCaptionSchema)) body: AddCaptionInput,
  ): Promise<BunnyStatusResponse> {
    const video = await this.videoContentService.getVideo(id);

    return this.videoService.addCaption(video.bunny_video_id, srclang, body, video.bunny_library_type as BunnyStreamLibrary);
  }

  @Delete(':id/captions/:srclang')
  async deleteCaption(@Param('id') id: string, @Param('srclang') srclang: string): Promise<BunnyStatusResponse> {
    const video = await this.videoContentService.getVideo(id);

    return this.videoService.deleteCaption(video.bunny_video_id, srclang, video.bunny_library_type as BunnyStreamLibrary);
  }
}
