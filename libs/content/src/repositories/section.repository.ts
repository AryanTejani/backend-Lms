import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { generateUuidV7 } from '@app/shared/utils/uuid.util';
import type { LessonType, TopicType, BunnyLibraryType, VideoStatus } from '@prisma/client';

export interface SectionRecord {
  id: string;
  product_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: Date;
  updated_at: Date;
  lessons?: SectionLessonRecord[];
  quizzes?: SectionQuizRecord[];
}

export interface SectionLessonRecord {
  id: string;
  product_id: string;
  section_id: string;
  title: string;
  content: string | null;
  video_id: string | null;
  lesson_type: 'video' | 'text';
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
  topics?: SectionTopicRecord[];
  topic_count?: number;
}

export interface SectionTopicRecord {
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

export interface SectionQuizRecord {
  id: string;
  product_id: string;
  section_id: string | null;
  title: string;
  description: string | null;
  passing_percentage: number;
  time_limit_seconds: number | null;
  sort_order: number;
  is_published: boolean;
  question_count?: number;
}

const LESSON_TYPE_MAP: Record<LessonType, 'video' | 'text'> = {
  VIDEO: 'video',
  TEXT: 'text',
};

const TOPIC_TYPE_MAP: Record<TopicType, 'video' | 'text'> = {
  VIDEO: 'video',
  TEXT: 'text',
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
export class SectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: {
    productId: string;
    title: string;
    description?: string | undefined;
    sortOrder?: number | undefined;
    isPublished?: boolean | undefined;
  }): Promise<SectionRecord> {
    const id = generateUuidV7();

    let sortOrder = params.sortOrder;

    if (sortOrder === undefined) {
      const maxSort = await this.prisma.section.aggregate({
        where: { productId: params.productId },
        _max: { sortOrder: true },
      });

      sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
    }

    const section = await this.prisma.section.create({
      data: {
        id,
        productId: params.productId,
        title: params.title,
        description: params.description ?? null,
        sortOrder,
        isPublished: params.isPublished ?? true,
      },
    });

    return this.mapToRecord(section);
  }

  async findById(id: string): Promise<SectionRecord | null> {
    const section = await this.prisma.section.findUnique({
      where: { id },
      include: {
        lessons: {
          orderBy: { sortOrder: 'asc' },
          include: {
            video: {
              select: { id: true, bunnyVideoId: true, title: true, thumbnailUrl: true, duration: true, bunnyLibraryType: true, videoStatus: true },
            },
            topics: {
              orderBy: { sortOrder: 'asc' },
              include: {
                video: {
                  select: { id: true, bunnyVideoId: true, title: true, thumbnailUrl: true, duration: true, bunnyLibraryType: true, videoStatus: true },
                },
              },
            },
            _count: { select: { topics: true } },
          },
        },
        quizzes: {
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: { select: { questions: true } },
          },
        },
      },
    });

    if (!section) {
      return null;
    }

    return this.mapToRecord(section);
  }

  async findByProductId(productId: string): Promise<SectionRecord[]> {
    const sections = await this.prisma.section.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
      include: {
        lessons: {
          orderBy: { sortOrder: 'asc' },
          include: {
            video: {
              select: { id: true, bunnyVideoId: true, title: true, thumbnailUrl: true, duration: true, bunnyLibraryType: true, videoStatus: true },
            },
            topics: {
              orderBy: { sortOrder: 'asc' },
              include: {
                video: {
                  select: { id: true, bunnyVideoId: true, title: true, thumbnailUrl: true, duration: true, bunnyLibraryType: true, videoStatus: true },
                },
              },
            },
            _count: { select: { topics: true } },
          },
        },
        quizzes: {
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: { select: { questions: true } },
          },
        },
      },
    });

    return sections.map((s) => this.mapToRecord(s));
  }

  async findByProductIdPublished(productId: string): Promise<SectionRecord[]> {
    const sections = await this.prisma.section.findMany({
      where: { productId, isPublished: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        lessons: {
          where: { isPublished: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            video: {
              select: { id: true, bunnyVideoId: true, title: true, thumbnailUrl: true, duration: true, bunnyLibraryType: true, videoStatus: true },
            },
            topics: {
              where: { isPublished: true },
              orderBy: { sortOrder: 'asc' },
              include: {
                video: {
                  select: { id: true, bunnyVideoId: true, title: true, thumbnailUrl: true, duration: true, bunnyLibraryType: true, videoStatus: true },
                },
              },
            },
            _count: { select: { topics: true } },
          },
        },
        quizzes: {
          where: { isPublished: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: { select: { questions: true } },
          },
        },
      },
    });

    return sections
      .filter((s) => s.lessons.length > 0 || s.quizzes.length > 0)
      .map((s) => this.mapToRecord(s));
  }

  async update(
    id: string,
    data: {
      title?: string | undefined;
      description?: string | null | undefined;
      sortOrder?: number | undefined;
      isPublished?: boolean | undefined;
    },
  ): Promise<SectionRecord> {
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) {
      updateData.title = data.title;
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    if (data.sortOrder !== undefined) {
      updateData.sortOrder = data.sortOrder;
    }

    if (data.isPublished !== undefined) {
      updateData.isPublished = data.isPublished;
    }

    const section = await this.prisma.section.update({
      where: { id },
      data: updateData,
    });

    return this.mapToRecord(section);
  }

  async publishByProductId(productId: string): Promise<void> {
    await this.prisma.section.updateMany({
      where: { productId },
      data: { isPublished: true },
    });
  }

  async unpublishByProductId(productId: string): Promise<void> {
    await this.prisma.section.updateMany({
      where: { productId },
      data: { isPublished: false },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.section.delete({ where: { id } });
  }

  async reorder(sectionIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      sectionIds.map((id, index) =>
        this.prisma.section.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  private mapToRecord(section: {
    id: string;
    productId: string;
    title: string;
    description: string | null;
    sortOrder: number;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
    lessons?: Array<{
      id: string;
      productId: string;
      sectionId: string;
      title: string;
      content: string | null;
      videoId: string | null;
      lessonType: LessonType;
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
      topics?: Array<{
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
      }>;
      _count?: { topics: number };
    }>;
    quizzes?: Array<{
      id: string;
      productId: string;
      sectionId: string | null;
      title: string;
      description: string | null;
      passingPercentage: number;
      timeLimitSeconds: number | null;
      sortOrder: number;
      isPublished: boolean;
      _count?: { questions: number };
    }>;
  }): SectionRecord {
    return {
      id: section.id,
      product_id: section.productId,
      title: section.title,
      description: section.description,
      sort_order: section.sortOrder,
      is_published: section.isPublished,
      created_at: section.createdAt,
      updated_at: section.updatedAt,
      ...(section.lessons && {
        lessons: section.lessons.map((l) => ({
          id: l.id,
          product_id: l.productId,
          section_id: l.sectionId,
          title: l.title,
          content: l.content,
          video_id: l.videoId,
          lesson_type: LESSON_TYPE_MAP[l.lessonType],
          duration: l.duration,
          sort_order: l.sortOrder,
          is_published: l.isPublished,
          created_at: l.createdAt,
          updated_at: l.updatedAt,
          ...(l.video !== undefined && {
            video: l.video
              ? {
                  id: l.video.id,
                  bunny_video_id: l.video.bunnyVideoId,
                  title: l.video.title,
                  thumbnail_url: l.video.thumbnailUrl,
                  duration: l.video.duration,
                  bunny_library_type: LIBRARY_TYPE_MAP[l.video.bunnyLibraryType],
                  video_status: VIDEO_STATUS_MAP[l.video.videoStatus],
                }
              : null,
          }),
          ...(l.topics && {
            topics: l.topics.map((t) => ({
              id: t.id,
              lesson_id: t.lessonId,
              product_id: t.productId,
              section_id: t.sectionId,
              title: t.title,
              content: t.content,
              video_id: t.videoId,
              topic_type: TOPIC_TYPE_MAP[t.topicType],
              duration: t.duration,
              sort_order: t.sortOrder,
              is_published: t.isPublished,
              created_at: t.createdAt,
              updated_at: t.updatedAt,
              ...(t.video !== undefined && {
                video: t.video
                  ? {
                      id: t.video.id,
                      bunny_video_id: t.video.bunnyVideoId,
                      title: t.video.title,
                      thumbnail_url: t.video.thumbnailUrl,
                      duration: t.video.duration,
                      bunny_library_type: LIBRARY_TYPE_MAP[t.video.bunnyLibraryType],
                      video_status: VIDEO_STATUS_MAP[t.video.videoStatus],
                    }
                  : null,
              }),
            })),
          }),
          ...(l._count && { topic_count: l._count.topics }),
        })),
      }),
      ...(section.quizzes && {
        quizzes: section.quizzes.map((q) => ({
          id: q.id,
          product_id: q.productId,
          section_id: q.sectionId,
          title: q.title,
          description: q.description,
          passing_percentage: q.passingPercentage,
          time_limit_seconds: q.timeLimitSeconds,
          sort_order: q.sortOrder,
          is_published: q.isPublished,
          ...(q._count && { question_count: q._count.questions }),
        })),
      }),
    };
  }
}
