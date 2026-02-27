import { Injectable } from '@nestjs/common';
import { VideoService } from '@app/shared/storage/video.service';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { VideoRepository, VideoRecord } from '../repositories/video.repository';
import type { BunnyLibraryType } from '@prisma/client';
import type { BunnyStreamLibrary } from '@app/shared/storage/video.service';

const LIBRARY_TYPE_TO_PRISMA: Record<BunnyStreamLibrary, BunnyLibraryType> = {
  public: 'PUBLIC',
  private: 'PRIVATE',
};

@Injectable()
export class VideoContentService {
  constructor(
    private readonly videoRepository: VideoRepository,
    private readonly videoService: VideoService,
  ) {}

  async createVideo(
    instructorId: string,
    input: {
      title: string;
      description?: string | undefined;
      categoryId?: string | undefined;
      libraryType?: BunnyStreamLibrary | undefined;
    },
  ): Promise<VideoRecord> {
    const libraryType: BunnyStreamLibrary = input.libraryType ?? 'private';

    // Create video in Bunny CDN first
    const bunnyVideo = await this.videoService.createVideo({ title: input.title }, libraryType);

    // Create DB record
    return this.videoRepository.create({
      bunnyVideoId: bunnyVideo.guid,
      title: input.title,
      description: input.description,
      thumbnailUrl: bunnyVideo.thumbnailUrl || undefined,
      bunnyLibraryType: LIBRARY_TYPE_TO_PRISMA[libraryType],
      instructorId,
      categoryId: input.categoryId,
    });
  }

  async getVideo(id: string): Promise<VideoRecord> {
    const video = await this.videoRepository.findById(id);

    if (!video) {
      throw Errors.videoNotFound();
    }

    // Sync processing status from Bunny if not yet ready
    if (video.video_status !== 'ready') {
      try {
        const bunnyVideo = await this.videoService.getVideo(
          video.bunny_video_id,
          video.bunny_library_type as BunnyStreamLibrary,
        );
        const newStatus = this.mapBunnyStatus(bunnyVideo.status, bunnyVideo.encodeProgress);

        if (newStatus !== video.video_status || bunnyVideo.encodeProgress !== video.encode_progress) {
          await this.videoRepository.updateStatus(video.id, newStatus, bunnyVideo.encodeProgress);
          video.video_status = newStatus;
          video.encode_progress = bunnyVideo.encodeProgress;
        }

        // Sync duration from Bunny when available
        if (bunnyVideo.length > 0 && bunnyVideo.length !== video.duration) {
          await this.videoRepository.update(video.id, { duration: bunnyVideo.length });
          video.duration = bunnyVideo.length;
        }
      } catch {
        // Bunny API failure shouldn't block returning the video record
      }
    }

    return video;
  }

  private mapBunnyStatus(bunnyStatus: number, encodeProgress: number): 'processing' | 'ready' | 'failed' {
    // Bunny: 0=created, 1=uploaded, 2=processing, 3=transcoding, 4=finished, 5=error, 6=upload_failed
    if (bunnyStatus >= 5) {
return 'failed';
}

    if (bunnyStatus === 4 && encodeProgress === 100) {
return 'ready';
}
    
return 'processing';
  }

  async listVideos(params: {
    page: number;
    limit: number;
    instructorId?: string | undefined;
    categoryId?: string | undefined;
    isPublished?: boolean | undefined;
  }): Promise<{ data: VideoRecord[]; total: number; page: number; limit: number }> {
    const result = await this.videoRepository.findAll({
      page: params.page,
      limit: params.limit,
      instructorId: params.instructorId,
      categoryId: params.categoryId,
      isPublished: params.isPublished,
    });

    // Sync processing status from Bunny for videos still encoding
    const processingVideos = result.data.filter((v) => v.video_status === 'processing');

    if (processingVideos.length > 0) {
      const statusResults = await Promise.allSettled(
        processingVideos.map(async (video) => {
          const bunnyVideo = await this.videoService.getVideo(video.bunny_video_id, video.bunny_library_type as BunnyStreamLibrary);
          const newStatus = this.mapBunnyStatus(bunnyVideo.status, bunnyVideo.encodeProgress);

          if (newStatus !== video.video_status || bunnyVideo.encodeProgress !== video.encode_progress) {
            await this.videoRepository.updateStatus(video.id, newStatus, bunnyVideo.encodeProgress);
            video.video_status = newStatus;
            video.encode_progress = bunnyVideo.encodeProgress;
          }

          if (bunnyVideo.length > 0 && bunnyVideo.length !== video.duration) {
            await this.videoRepository.update(video.id, { duration: bunnyVideo.length });
            video.duration = bunnyVideo.length;
          }

          return video;
        }),
      );

      // Log failures but don't block
      for (const r of statusResults) {
        if (r.status === 'rejected') {
          // Bunny API failure for one video shouldn't affect others
        }
      }
    }

    return { ...result, page: params.page, limit: params.limit };
  }

  async updateVideo(
    videoId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    input: {
      title?: string | undefined;
      description?: string | null | undefined;
      categoryId?: string | null | undefined;
      sortOrder?: number | undefined;
    },
  ): Promise<VideoRecord> {
    const video = await this.videoRepository.findById(videoId);

    if (!video) {
      throw Errors.videoNotFound();
    }

    if (admin.role === 'instructor' && video.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    // Update title in Bunny CDN if changed
    if (input.title !== undefined) {
      await this.videoService.updateVideo(video.bunny_video_id, { title: input.title }, video.bunny_library_type as BunnyStreamLibrary);
    }

    return this.videoRepository.update(videoId, {
      title: input.title,
      description: input.description,
      categoryId: input.categoryId,
      sortOrder: input.sortOrder,
    });
  }

  async deleteVideo(videoId: string, admin: { id: string; role: 'admin' | 'instructor' }): Promise<void> {
    const video = await this.videoRepository.findById(videoId);

    if (!video) {
      throw Errors.videoNotFound();
    }

    if (admin.role === 'instructor' && video.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    // Delete from Bunny CDN
    await this.videoService.deleteVideo(video.bunny_video_id, video.bunny_library_type as BunnyStreamLibrary);

    // Soft delete DB record
    await this.videoRepository.softDelete(videoId);
  }

  async publishVideo(videoId: string, admin: { id: string; role: 'admin' | 'instructor' }): Promise<VideoRecord> {
    const video = await this.videoRepository.findById(videoId);

    if (!video) {
      throw Errors.videoNotFound();
    }

    if (admin.role === 'instructor' && video.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    return this.videoRepository.publish(videoId);
  }

  async unpublishVideo(videoId: string, admin: { id: string; role: 'admin' | 'instructor' }): Promise<VideoRecord> {
    const video = await this.videoRepository.findById(videoId);

    if (!video) {
      throw Errors.videoNotFound();
    }

    if (admin.role === 'instructor' && video.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    return this.videoRepository.unpublish(videoId);
  }

  async syncVideosFromBunny(instructorId: string): Promise<{ synced: number; total_in_bunny: number }> {
    const [publicVideos, privateVideos] = await Promise.all([
      this.videoService.listAllVideos('public'),
      this.videoService.listAllVideos('private'),
    ]);

    const publicRecords = publicVideos.map((v) => ({
      bunnyVideoId: v.guid,
      title: v.title,
      description: v.description || undefined,
      thumbnailUrl: v.thumbnailUrl || undefined,
      duration: v.length,
      bunnyLibraryType: LIBRARY_TYPE_TO_PRISMA['public'] as BunnyLibraryType,
      instructorId,
    }));

    const privateRecords = privateVideos.map((v) => ({
      bunnyVideoId: v.guid,
      title: v.title,
      description: v.description || undefined,
      thumbnailUrl: v.thumbnailUrl || undefined,
      duration: v.length,
      bunnyLibraryType: LIBRARY_TYPE_TO_PRISMA['private'] as BunnyLibraryType,
      instructorId,
    }));

    const allRecords = [...publicRecords, ...privateRecords];
    const synced = await this.videoRepository.createMany(allRecords);

    return {
      synced,
      total_in_bunny: allRecords.length,
    };
  }
}
