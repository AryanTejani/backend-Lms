import { Injectable } from '@nestjs/common';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { VideoService } from '@app/shared/storage/video.service';
import { TopicRepository, TopicRecord } from '../repositories/topic.repository';
import { LessonRepository } from '../repositories/lesson.repository';
import { VideoRepository } from '../repositories/video.repository';
import { SectionRepository } from '../repositories/section.repository';
import { CourseProductService } from './course-product.service';
import type { BunnyStreamLibrary } from '@app/shared/storage/video.service';

@Injectable()
export class TopicService {
  constructor(
    private readonly topicRepository: TopicRepository,
    private readonly lessonRepository: LessonRepository,
    private readonly videoRepository: VideoRepository,
    private readonly sectionRepository: SectionRepository,
    private readonly courseProductService: CourseProductService,
    private readonly videoService: VideoService,
  ) {}

  async addTopic(
    productId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    input: {
      title: string;
      topicType: string;
      lessonId: string;
      sectionId: string;
      content?: string | undefined;
      videoId?: string | undefined;
      duration?: number | undefined;
    },
  ): Promise<TopicRecord> {
    const course = await this.courseProductService.getCourse(productId);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    // Validate lesson belongs to this product
    const lesson = await this.lessonRepository.findById(input.lessonId);

    if (!lesson || lesson.product_id !== productId) {
      throw Errors.lessonNotFound();
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

    return this.topicRepository.create({
      lessonId: input.lessonId,
      productId,
      sectionId: input.sectionId,
      title: input.title,
      topicType: input.topicType,
      content: input.content,
      videoId: input.videoId,
      duration: input.duration,
      isPublished: course.is_published,
    });
  }

  async getTopic(id: string): Promise<TopicRecord> {
    const topic = await this.topicRepository.findById(id);

    if (!topic) {
      throw Errors.topicNotFound();
    }

    return topic;
  }

  async listTopics(lessonId: string): Promise<TopicRecord[]> {
    return this.topicRepository.findByLessonId(lessonId);
  }

  async updateTopic(
    topicId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    input: {
      title?: string | undefined;
      content?: string | null | undefined;
      videoId?: string | null | undefined;
      topicType?: string | undefined;
      duration?: number | null | undefined;
      lessonId?: string | undefined;
      isPublished?: boolean | undefined;
    },
  ): Promise<TopicRecord> {
    const topic = await this.topicRepository.findById(topicId);

    if (!topic) {
      throw Errors.topicNotFound();
    }

    // Check ownership through parent product
    const course = await this.courseProductService.getCourse(topic.product_id);

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

    return this.topicRepository.update(topicId, input);
  }

  async removeTopic(topicId: string, admin: { id: string; role: 'admin' | 'instructor' }): Promise<void> {
    const topic = await this.topicRepository.findById(topicId);

    if (!topic) {
      throw Errors.topicNotFound();
    }

    const course = await this.courseProductService.getCourse(topic.product_id);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    await this.topicRepository.delete(topicId);
  }

  async reorderTopics(
    lessonId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    topicIds: string[],
  ): Promise<TopicRecord[]> {
    // Validate all topic IDs belong to this lesson
    const existingTopics = await this.topicRepository.findByLessonId(lessonId);

    if (existingTopics.length === 0) {
      throw Errors.lessonNotFound();
    }

    const course = await this.courseProductService.getCourse(existingTopics[0]!.product_id);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    const existingIds = new Set(existingTopics.map((t) => t.id));

    for (const id of topicIds) {
      if (!existingIds.has(id)) {
        throw Errors.topicNotFound();
      }
    }

    await this.topicRepository.reorder(topicIds);

    return this.topicRepository.findByLessonId(lessonId);
  }

  async getTopicForCustomer(
    topicId: string,
    customerId: string | undefined,
  ): Promise<TopicRecord & { embed_url?: string | undefined; video_status?: string | undefined }> {
    const topic = await this.topicRepository.findById(topicId);

    if (!topic || !topic.is_published) {
      throw Errors.topicNotFound();
    }

    // Check access through parent product
    const course = await this.courseProductService.getCourse(topic.product_id);

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

    // For video topics, check processing status before returning playback URL
    if (topic.topic_type === 'video' && topic.video) {
      if (topic.video.video_status !== 'ready') {
        return { ...topic, embed_url: undefined, video_status: topic.video.video_status };
      }

      const embedUrl = this.videoService.getEmbedUrl(topic.video.bunny_video_id, topic.video.bunny_library_type as BunnyStreamLibrary);

      return { ...topic, embed_url: embedUrl, video_status: 'ready' };
    }

    // Extract embed_url from content if it contains a Bunny iframe
    const iframeMatch = topic.content?.match(/src="(https:\/\/iframe\.mediadelivery\.net\/embed\/[^"]+)"/);

    if (iframeMatch?.[1]) {
      return { ...topic, embed_url: iframeMatch[1], video_status: 'ready' };
    }

    return topic;
  }
}
