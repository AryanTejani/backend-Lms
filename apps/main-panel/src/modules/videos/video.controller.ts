import { Controller, Get, Query } from '@nestjs/common';
import { VideoContentService } from '@app/content/services/video-content.service';
import type { VideoRecord } from '@app/content/repositories/video.repository';

@Controller('videos')
export class VideoController {
  constructor(private readonly videoContentService: VideoContentService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category_id') categoryId?: string,
  ): Promise<{ data: VideoRecord[]; total: number; page: number; limit: number }> {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));

    return this.videoContentService.listVideos({
      page: pageNum,
      limit: limitNum,
      categoryId,
      isPublished: true,
    });
  }
}
