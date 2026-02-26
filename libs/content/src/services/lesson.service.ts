import { Injectable } from '@nestjs/common';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { VideoService } from '@app/shared/storage/video.service';
import { LessonRepository, LessonRecord } from '../repositories/lesson.repository';
import { VideoRepository } from '../repositories/video.repository';
import { SectionRepository } from '../repositories/section.repository';
import { CourseProductService } from './course-product.service';
import type { BunnyStreamLibrary } from '@app/shared/storage/video.service';

@Injectable()
export class LessonService {
  constructor(
    private readonly lessonRepository: LessonRepository,
    private readonly videoRepository: VideoRepository,
    private readonly sectionRepository: SectionRepository,
    private readonly courseProductService: CourseProductService,
    private readonly videoService: VideoService,
  ) {}

  async addLesson(
    productId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    input: {
      title: string;
      lessonType: string;
      sectionId: string;
      content?: string | undefined;
      videoId?: string | undefined;
      duration?: number | undefined;
    },
  ): Promise<LessonRecord> {
    const course = await this.courseProductService.getCourse(productId);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    // Validate section belongs to this product
    const section = await this.sectionRepository.findById(input.sectionId);

    if (!section || section.product_id !== productId) {
      throw Errors.sectionNotFound();
    }

    // Validate video exists if provided
    if (input.videoId) {
      const video = await this.videoRepository.findById(input.videoId);

      if (!video) {
        throw Errors.videoNotFound();
      }
    }

    return this.lessonRepository.create({
      productId,
      sectionId: input.sectionId,
      title: input.title,
      lessonType: input.lessonType,
      content: input.content,
      videoId: input.videoId,
      duration: input.duration,
      isPublished: course.is_published,
    });
  }

  async getLesson(id: string): Promise<LessonRecord> {
    const lesson = await this.lessonRepository.findById(id);

    if (!lesson) {
      throw Errors.lessonNotFound();
    }

    return lesson;
  }

  async listLessons(productId: string): Promise<LessonRecord[]> {
    return this.lessonRepository.findByProductId(productId);
  }

  async updateLesson(
    lessonId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    input: {
      title?: string | undefined;
      content?: string | null | undefined;
      videoId?: string | null | undefined;
      lessonType?: string | undefined;
      duration?: number | null | undefined;
      sectionId?: string | undefined;
      isPublished?: boolean | undefined;
    },
  ): Promise<LessonRecord> {
    const lesson = await this.lessonRepository.findById(lessonId);

    if (!lesson) {
      throw Errors.lessonNotFound();
    }

    // Check ownership through parent product
    const course = await this.courseProductService.getCourse(lesson.product_id);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    // Validate video exists if changing
    if (input.videoId) {
      const video = await this.videoRepository.findById(input.videoId);

      if (!video) {
        throw Errors.videoNotFound();
      }
    }

    return this.lessonRepository.update(lessonId, input);
  }

  async removeLesson(lessonId: string, admin: { id: string; role: 'admin' | 'instructor' }): Promise<void> {
    const lesson = await this.lessonRepository.findById(lessonId);

    if (!lesson) {
      throw Errors.lessonNotFound();
    }

    const course = await this.courseProductService.getCourse(lesson.product_id);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    await this.lessonRepository.delete(lessonId);
  }

  async reorderLessons(productId: string, admin: { id: string; role: 'admin' | 'instructor' }, lessonIds: string[]): Promise<LessonRecord[]> {
    const course = await this.courseProductService.getCourse(productId);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    // Validate all lesson IDs belong to this product
    const existingLessons = await this.lessonRepository.findByProductId(productId);
    const existingIds = new Set(existingLessons.map((l) => l.id));

    for (const id of lessonIds) {
      if (!existingIds.has(id)) {
        throw Errors.lessonNotFound();
      }
    }

    await this.lessonRepository.reorder(lessonIds);

    return this.lessonRepository.findByProductId(productId);
  }

  async getLessonForCustomer(
    lessonId: string,
    customerId: string | undefined,
  ): Promise<LessonRecord & { embed_url?: string | undefined; video_status?: string | undefined }> {
    const lesson = await this.lessonRepository.findById(lessonId);

    if (!lesson || !lesson.is_published) {
      throw Errors.lessonNotFound();
    }

    // Check access through parent product
    const course = await this.courseProductService.getCourse(lesson.product_id);

    if (!course.is_published) {
      throw Errors.courseNotFound();
    }

    if (Number(course.amount_cents) > 0) {
      if (!customerId) {
        throw Errors.courseAccessDenied();
      }

      const hasAccess = await this.courseProductService.checkAccess(customerId, course.id);

      if (!hasAccess) {
        throw Errors.courseAccessDenied();
      }
    }

    // For video lessons, check processing status before returning playback URL
    if (lesson.lesson_type === 'video' && lesson.video) {
      if (lesson.video.video_status !== 'ready') {
        return { ...lesson, embed_url: undefined, video_status: lesson.video.video_status };
      }

      const embedUrl = this.videoService.getEmbedUrl(lesson.video.bunny_video_id, lesson.video.bunny_library_type as BunnyStreamLibrary);

      return { ...lesson, embed_url: embedUrl, video_status: 'ready' };
    }

    // Extract embed_url from content if it contains a Bunny iframe
    const iframeMatch = lesson.content?.match(/src="(https:\/\/iframe\.mediadelivery\.net\/embed\/[^"]+)"/);

    if (iframeMatch?.[1]) {
      return { ...lesson, embed_url: iframeMatch[1], video_status: 'ready' };
    }

    return lesson;
  }
}
