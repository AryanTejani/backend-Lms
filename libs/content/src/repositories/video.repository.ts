import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { generateUuidV7 } from '@app/shared/utils/uuid.util';
import type { BunnyLibraryType, VideoStatus } from '@prisma/client';

export interface VideoRecord {
  id: string;
  bunny_video_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration: number;
  bunny_library_type: 'public' | 'private';
  video_status: 'processing' | 'ready' | 'failed';
  encode_progress: number;
  instructor_id: string;
  category_id: string | null;
  is_published: boolean;
  published_at: Date | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  instructor?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

const LIBRARY_TYPE_MAP: Record<BunnyLibraryType, 'public' | 'private'> = {
  PUBLIC: 'public',
  PRIVATE: 'private',
};

const VIDEO_STATUS_MAP: Record<VideoStatus, 'processing' | 'ready' | 'failed'> = {
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
};

const VIDEO_STATUS_TO_PRISMA: Record<'processing' | 'ready' | 'failed', VideoStatus> = {
  processing: 'PROCESSING',
  ready: 'READY',
  failed: 'FAILED',
};

@Injectable()
export class VideoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: {
    bunnyVideoId: string;
    title: string;
    description?: string | undefined;
    thumbnailUrl?: string | undefined;
    duration?: number | undefined;
    bunnyLibraryType?: BunnyLibraryType | undefined;
    instructorId: string;
    categoryId?: string | undefined;
  }): Promise<VideoRecord> {
    const id = generateUuidV7();
    const video = await this.prisma.video.create({
      data: {
        id,
        bunnyVideoId: params.bunnyVideoId,
        title: params.title,
        description: params.description ?? null,
        thumbnailUrl: params.thumbnailUrl ?? null,
        duration: params.duration ?? 0,
        bunnyLibraryType: params.bunnyLibraryType ?? 'PRIVATE',
        instructorId: params.instructorId,
        categoryId: params.categoryId ?? null,
      },
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    return this.mapToRecord(video);
  }

  async createMany(
    videos: Array<{
      bunnyVideoId: string;
      title: string;
      description?: string | undefined;
      thumbnailUrl?: string | undefined;
      duration?: number | undefined;
      bunnyLibraryType?: BunnyLibraryType | undefined;
      instructorId: string;
    }>,
  ): Promise<number> {
    const result = await this.prisma.video.createMany({
      data: videos.map((v) => ({
        id: generateUuidV7(),
        bunnyVideoId: v.bunnyVideoId,
        title: v.title,
        description: v.description ?? null,
        thumbnailUrl: v.thumbnailUrl ?? null,
        duration: v.duration ?? 0,
        bunnyLibraryType: v.bunnyLibraryType ?? 'PRIVATE',
        instructorId: v.instructorId,
        categoryId: null,
      })),
      skipDuplicates: true,
    });

    return result.count;
  }

  async findById(id: string): Promise<VideoRecord | null> {
    const video = await this.prisma.video.findUnique({
      where: { id },
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!video || video.deletedAt !== null) {
      return null;
    }

    return this.mapToRecord(video);
  }

  async findByBunnyVideoId(bunnyVideoId: string): Promise<VideoRecord | null> {
    const video = await this.prisma.video.findUnique({
      where: { bunnyVideoId },
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!video || video.deletedAt !== null) {
      return null;
    }

    return this.mapToRecord(video);
  }

  async findAll(params: {
    page: number;
    limit: number;
    instructorId?: string | undefined;
    categoryId?: string | undefined;
    isPublished?: boolean | undefined;
  }): Promise<{ data: VideoRecord[]; total: number }> {
    const skip = (params.page - 1) * params.limit;
    const where: Record<string, unknown> = { deletedAt: null };

    if (params.instructorId) {
      where.instructorId = params.instructorId;
    }

    if (params.categoryId) {
      where.categoryId = params.categoryId;
    }

    if (params.isPublished !== undefined) {
      where.isPublished = params.isPublished;
    }

    const [videos, total] = await Promise.all([
      this.prisma.video.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.video.count({ where }),
    ]);

    return {
      data: videos.map((v) => this.mapToRecord(v)),
      total,
    };
  }

  async update(
    id: string,
    data: {
      title?: string | undefined;
      description?: string | null | undefined;
      thumbnailUrl?: string | null | undefined;
      duration?: number | undefined;
      categoryId?: string | null | undefined;
      isPublished?: boolean | undefined;
      publishedAt?: Date | null | undefined;
      sortOrder?: number | undefined;
    },
  ): Promise<VideoRecord> {
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) {
      updateData.title = data.title;
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    if (data.thumbnailUrl !== undefined) {
      updateData.thumbnailUrl = data.thumbnailUrl;
    }

    if (data.duration !== undefined) {
      updateData.duration = data.duration;
    }

    if (data.categoryId !== undefined) {
      updateData.categoryId = data.categoryId;
    }

    if (data.isPublished !== undefined) {
      updateData.isPublished = data.isPublished;
    }

    if (data.publishedAt !== undefined) {
      updateData.publishedAt = data.publishedAt;
    }

    if (data.sortOrder !== undefined) {
      updateData.sortOrder = data.sortOrder;
    }

    const video = await this.prisma.video.update({
      where: { id },
      data: updateData,
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    return this.mapToRecord(video);
  }

  async updateStatus(
    id: string,
    status: 'processing' | 'ready' | 'failed',
    encodeProgress: number,
  ): Promise<void> {
    await this.prisma.video.update({
      where: { id },
      data: {
        videoStatus: VIDEO_STATUS_TO_PRISMA[status],
        encodeProgress,
      },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.video.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async publish(id: string): Promise<VideoRecord> {
    const video = await this.prisma.video.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date() },
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    return this.mapToRecord(video);
  }

  async unpublish(id: string): Promise<VideoRecord> {
    const video = await this.prisma.video.update({
      where: { id },
      data: { isPublished: false, publishedAt: null },
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    return this.mapToRecord(video);
  }

  private mapToRecord(video: {
    id: string;
    bunnyVideoId: string;
    title: string;
    description: string | null;
    thumbnailUrl: string | null;
    duration: number;
    bunnyLibraryType: BunnyLibraryType;
    videoStatus: VideoStatus;
    encodeProgress: number;
    instructorId: string;
    categoryId: string | null;
    isPublished: boolean;
    publishedAt: Date | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    instructor?: { id: string; firstName: string | null; lastName: string | null; email: string };
    category?: { id: string; name: string; slug: string } | null;
  }): VideoRecord {
    return {
      id: video.id,
      bunny_video_id: video.bunnyVideoId,
      title: video.title,
      description: video.description,
      thumbnail_url: video.thumbnailUrl,
      duration: video.duration,
      bunny_library_type: LIBRARY_TYPE_MAP[video.bunnyLibraryType],
      video_status: VIDEO_STATUS_MAP[video.videoStatus],
      encode_progress: video.encodeProgress,
      instructor_id: video.instructorId,
      category_id: video.categoryId,
      is_published: video.isPublished,
      published_at: video.publishedAt,
      sort_order: video.sortOrder,
      created_at: video.createdAt,
      updated_at: video.updatedAt,
      deleted_at: video.deletedAt,
      ...(video.instructor && {
        instructor: {
          id: video.instructor.id,
          first_name: video.instructor.firstName,
          last_name: video.instructor.lastName,
          email: video.instructor.email,
        },
      }),
      ...(video.category !== undefined && {
        category: video.category
          ? { id: video.category.id, name: video.category.name, slug: video.category.slug }
          : null,
      }),
    };
  }
}
