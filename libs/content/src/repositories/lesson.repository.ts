import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { generateUuidV7 } from '@app/shared/utils/uuid.util';
import type { LessonType, BunnyLibraryType, VideoStatus } from '@prisma/client';

export interface LessonRecord {
  id: string;
  product_id: string;
  section_id: string;
  title: string;
  content: string | null;
  video_id: string | null;
  lesson_type: 'video' | 'text';
  duration: number | null;
  section_name: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: Date;
  updated_at: Date;
  video?: {
    id: string;
    bunny_video_id: string;
    title: string;
    thumbnail_url: string | null;
    duration: number;
    bunny_library_type: 'public' | 'private';
    video_status: 'processing' | 'ready' | 'failed';
  } | null;
}

const LESSON_TYPE_MAP: Record<LessonType, 'video' | 'text'> = {
  VIDEO: 'video',
  TEXT: 'text',
};

const LESSON_TYPE_TO_PRISMA: Record<string, LessonType> = {
  video: 'VIDEO',
  text: 'TEXT',
};

const LIBRARY_TYPE_MAP: Record<BunnyLibraryType, 'public' | 'private'> = {
  PUBLIC: 'public',
  PRIVATE: 'private',
};

const VIDEO_STATUS_MAP: Record<VideoStatus, 'processing' | 'ready' | 'failed'> = {
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
};

@Injectable()
export class LessonRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: {
    productId: string;
    sectionId: string;
    title: string;
    content?: string | undefined;
    videoId?: string | undefined;
    lessonType: string;
    duration?: number | undefined;
    sectionName?: string | undefined;
    sortOrder?: number | undefined;
    isPublished?: boolean | undefined;
  }): Promise<LessonRecord> {
    const id = generateUuidV7();

    // Auto-assign sort order scoped by section
    let sortOrder = params.sortOrder;

    if (sortOrder === undefined) {
      const maxSort = await this.prisma.lesson.aggregate({
        where: { sectionId: params.sectionId },
        _max: { sortOrder: true },
      });

      sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
    }

    const lesson = await this.prisma.lesson.create({
      data: {
        id,
        productId: params.productId,
        sectionId: params.sectionId,
        title: params.title,
        content: params.content ?? null,
        videoId: params.videoId ?? null,
        lessonType: LESSON_TYPE_TO_PRISMA[params.lessonType] ?? 'TEXT',
        duration: params.duration ?? null,
        sectionName: params.sectionName ?? null,
        sortOrder,
        isPublished: params.isPublished ?? false,
      },
      include: {
        video: {
          select: { id: true, bunnyVideoId: true, title: true, thumbnailUrl: true, duration: true, bunnyLibraryType: true, videoStatus: true },
        },
      },
    });

    return this.mapToRecord(lesson);
  }

  async findBySectionId(sectionId: string): Promise<LessonRecord[]> {
    const lessons = await this.prisma.lesson.findMany({
      where: { sectionId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        video: {
          select: { id: true, bunnyVideoId: true, title: true, thumbnailUrl: true, duration: true, bunnyLibraryType: true, videoStatus: true },
        },
      },
    });

    return lessons.map((l) => this.mapToRecord(l));
  }

  async findById(id: string): Promise<LessonRecord | null> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id, deletedAt: null },
      include: {
        video: {
          select: { id: true, bunnyVideoId: true, title: true, thumbnailUrl: true, duration: true, bunnyLibraryType: true, videoStatus: true },
        },
      },
    });

    if (!lesson) {
      return null;
    }

    return this.mapToRecord(lesson);
  }

  async findByProductId(productId: string, isPublished?: boolean): Promise<LessonRecord[]> {
    const where: Record<string, unknown> = { productId, deletedAt: null };

    if (isPublished !== undefined) {
      where.isPublished = isPublished;
    }

    const lessons = await this.prisma.lesson.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        video: {
          select: { id: true, bunnyVideoId: true, title: true, thumbnailUrl: true, duration: true, bunnyLibraryType: true, videoStatus: true },
        },
      },
    });

    return lessons.map((l) => this.mapToRecord(l));
  }

  async update(
    id: string,
    data: {
      title?: string | undefined;
      content?: string | null | undefined;
      videoId?: string | null | undefined;
      lessonType?: string | undefined;
      duration?: number | null | undefined;
      sectionId?: string | undefined;
      sortOrder?: number | undefined;
      isPublished?: boolean | undefined;
    },
  ): Promise<LessonRecord> {
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) {
      updateData.title = data.title;
    }

    if (data.content !== undefined) {
      updateData.content = data.content;
    }

    if (data.videoId !== undefined) {
      updateData.videoId = data.videoId;
    }

    if (data.lessonType !== undefined) {
      updateData.lessonType = LESSON_TYPE_TO_PRISMA[data.lessonType] ?? 'TEXT';
    }

    if (data.duration !== undefined) {
      updateData.duration = data.duration;
    }

    if (data.sectionId !== undefined) {
      updateData.sectionId = data.sectionId;
    }

    if (data.sortOrder !== undefined) {
      updateData.sortOrder = data.sortOrder;
    }

    if (data.isPublished !== undefined) {
      updateData.isPublished = data.isPublished;
    }

    const lesson = await this.prisma.lesson.update({
      where: { id },
      data: updateData,
      include: {
        video: {
          select: { id: true, bunnyVideoId: true, title: true, thumbnailUrl: true, duration: true, bunnyLibraryType: true, videoStatus: true },
        },
      },
    });

    return this.mapToRecord(lesson);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.lesson.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async publishByProductId(productId: string): Promise<void> {
    await this.prisma.lesson.updateMany({
      where: { productId },
      data: { isPublished: true },
    });
  }

  async unpublishByProductId(productId: string): Promise<void> {
    await this.prisma.lesson.updateMany({
      where: { productId },
      data: { isPublished: false },
    });
  }

  async reorder(lessonIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      lessonIds.map((id, index) =>
        this.prisma.lesson.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  private mapToRecord(lesson: {
    id: string;
    productId: string;
    sectionId: string;
    title: string;
    content: string | null;
    videoId: string | null;
    lessonType: LessonType;
    duration: number | null;
    sectionName: string | null;
    sortOrder: number;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
    video?: {
      id: string;
      bunnyVideoId: string;
      title: string;
      thumbnailUrl: string | null;
      duration: number;
      bunnyLibraryType: BunnyLibraryType;
      videoStatus: VideoStatus;
    } | null;
  }): LessonRecord {
    return {
      id: lesson.id,
      product_id: lesson.productId,
      section_id: lesson.sectionId,
      title: lesson.title,
      content: lesson.content,
      video_id: lesson.videoId,
      lesson_type: LESSON_TYPE_MAP[lesson.lessonType],
      duration: lesson.duration,
      section_name: lesson.sectionName,
      sort_order: lesson.sortOrder,
      is_published: lesson.isPublished,
      created_at: lesson.createdAt,
      updated_at: lesson.updatedAt,
      ...(lesson.video !== undefined && {
        video: lesson.video
          ? {
              id: lesson.video.id,
              bunny_video_id: lesson.video.bunnyVideoId,
              title: lesson.video.title,
              thumbnail_url: lesson.video.thumbnailUrl,
              duration: lesson.video.duration,
              bunny_library_type: LIBRARY_TYPE_MAP[lesson.video.bunnyLibraryType],
              video_status: VIDEO_STATUS_MAP[lesson.video.videoStatus],
            }
          : null,
      }),
    };
  }
}
