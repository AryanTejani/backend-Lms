import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { generateUuidV7 } from '@app/shared/utils/uuid.util';
import type { TopicType, BunnyLibraryType, VideoStatus } from '@prisma/client';

export interface TopicRecord {
  id: string;
  lesson_id: string;
  product_id: string;
  section_id: string;
  title: string;
  content: string | null;
  video_id: string | null;
  topic_type: 'video' | 'text';
  duration: number | null;
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

const TOPIC_TYPE_MAP: Record<TopicType, 'video' | 'text'> = {
  VIDEO: 'video',
  TEXT: 'text',
};

const TOPIC_TYPE_TO_PRISMA: Record<string, TopicType> = {
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
export class TopicRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: {
    lessonId: string;
    productId: string;
    sectionId: string;
    title: string;
    content?: string | undefined;
    videoId?: string | undefined;
    topicType: string;
    duration?: number | undefined;
    sortOrder?: number | undefined;
    isPublished?: boolean | undefined;
  }): Promise<TopicRecord> {
    const id = generateUuidV7();

    let sortOrder = params.sortOrder;

    if (sortOrder === undefined) {
      const maxSort = await this.prisma.topic.aggregate({
        where: { lessonId: params.lessonId },
        _max: { sortOrder: true },
      });

      sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
    }

    const topic = await this.prisma.topic.create({
      data: {
        id,
        lessonId: params.lessonId,
        productId: params.productId,
        sectionId: params.sectionId,
        title: params.title,
        content: params.content ?? null,
        videoId: params.videoId ?? null,
        topicType: TOPIC_TYPE_TO_PRISMA[params.topicType] ?? 'TEXT',
        duration: params.duration ?? null,
        sortOrder,
        isPublished: params.isPublished ?? false,
      },
      include: {
        video: {
          select: { id: true, bunnyVideoId: true, title: true, thumbnailUrl: true, duration: true, bunnyLibraryType: true, videoStatus: true },
        },
      },
    });

    return this.mapToRecord(topic);
  }

  async findById(id: string): Promise<TopicRecord | null> {
    const topic = await this.prisma.topic.findUnique({
      where: { id },
      include: {
        video: {
          select: { id: true, bunnyVideoId: true, title: true, thumbnailUrl: true, duration: true, bunnyLibraryType: true, videoStatus: true },
        },
      },
    });

    if (!topic) {
      return null;
    }

    return this.mapToRecord(topic);
  }

  async findByLessonId(lessonId: string): Promise<TopicRecord[]> {
    const topics = await this.prisma.topic.findMany({
      where: { lessonId },
      orderBy: { sortOrder: 'asc' },
      include: {
        video: {
          select: { id: true, bunnyVideoId: true, title: true, thumbnailUrl: true, duration: true, bunnyLibraryType: true, videoStatus: true },
        },
      },
    });

    return topics.map((t) => this.mapToRecord(t));
  }

  async findByProductId(productId: string, isPublished?: boolean): Promise<TopicRecord[]> {
    const where: Record<string, unknown> = { productId };

    if (isPublished !== undefined) {
      where.isPublished = isPublished;
    }

    const topics = await this.prisma.topic.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        video: {
          select: { id: true, bunnyVideoId: true, title: true, thumbnailUrl: true, duration: true, bunnyLibraryType: true, videoStatus: true },
        },
      },
    });

    return topics.map((t) => this.mapToRecord(t));
  }

  async update(
    id: string,
    data: {
      title?: string | undefined;
      content?: string | null | undefined;
      videoId?: string | null | undefined;
      topicType?: string | undefined;
      duration?: number | null | undefined;
      lessonId?: string | undefined;
      sortOrder?: number | undefined;
      isPublished?: boolean | undefined;
    },
  ): Promise<TopicRecord> {
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

    if (data.topicType !== undefined) {
      updateData.topicType = TOPIC_TYPE_TO_PRISMA[data.topicType] ?? 'TEXT';
    }

    if (data.duration !== undefined) {
      updateData.duration = data.duration;
    }

    if (data.lessonId !== undefined) {
      updateData.lessonId = data.lessonId;
    }

    if (data.sortOrder !== undefined) {
      updateData.sortOrder = data.sortOrder;
    }

    if (data.isPublished !== undefined) {
      updateData.isPublished = data.isPublished;
    }

    const topic = await this.prisma.topic.update({
      where: { id },
      data: updateData,
      include: {
        video: {
          select: { id: true, bunnyVideoId: true, title: true, thumbnailUrl: true, duration: true, bunnyLibraryType: true, videoStatus: true },
        },
      },
    });

    return this.mapToRecord(topic);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.topic.delete({ where: { id } });
  }

  async publishByProductId(productId: string): Promise<void> {
    await this.prisma.topic.updateMany({
      where: { productId },
      data: { isPublished: true },
    });
  }

  async unpublishByProductId(productId: string): Promise<void> {
    await this.prisma.topic.updateMany({
      where: { productId },
      data: { isPublished: false },
    });
  }

  async reorder(topicIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      topicIds.map((id, index) =>
        this.prisma.topic.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  private mapToRecord(topic: {
    id: string;
    lessonId: string;
    productId: string;
    sectionId: string;
    title: string;
    content: string | null;
    videoId: string | null;
    topicType: TopicType;
    duration: number | null;
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
  }): TopicRecord {
    return {
      id: topic.id,
      lesson_id: topic.lessonId,
      product_id: topic.productId,
      section_id: topic.sectionId,
      title: topic.title,
      content: topic.content,
      video_id: topic.videoId,
      topic_type: TOPIC_TYPE_MAP[topic.topicType],
      duration: topic.duration,
      sort_order: topic.sortOrder,
      is_published: topic.isPublished,
      created_at: topic.createdAt,
      updated_at: topic.updatedAt,
      ...(topic.video !== undefined && {
        video: topic.video
          ? {
              id: topic.video.id,
              bunny_video_id: topic.video.bunnyVideoId,
              title: topic.video.title,
              thumbnail_url: topic.video.thumbnailUrl,
              duration: topic.video.duration,
              bunny_library_type: LIBRARY_TYPE_MAP[topic.video.bunnyLibraryType],
              video_status: VIDEO_STATUS_MAP[topic.video.videoStatus],
            }
          : null,
      }),
    };
  }
}
