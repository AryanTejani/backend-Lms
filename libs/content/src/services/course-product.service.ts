import { Injectable } from '@nestjs/common';
import { ProductContentType } from '@prisma/client';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { generateUuidV7 } from '@app/shared/utils/uuid.util';
import { LessonRepository } from '../repositories/lesson.repository';
import type { LessonRecord } from '../repositories/lesson.repository';
import { QuizRepository } from '../repositories/quiz.repository';
import { SectionRepository } from '../repositories/section.repository';
import type { SectionRecord } from '../repositories/section.repository';
import { TopicRepository } from '../repositories/topic.repository';

export interface CourseProductRecord {
  id: string;
  product_name: string;
  product_slug: string | null;
  product_description: string | null;
  thumbnail_url: string | null;
  amount_cents: number;
  currency: string;
  language: string;
  content_type: string;
  instructor_id: string | null;
  is_published: boolean;
  published_at: Date | null;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  has_access?: boolean;
  stripe_price_id?: string | null;
  instructor?: { id: string; first_name: string | null; last_name: string | null; email: string };
  sections?: SectionRecord[];
  lessons?: LessonRecord[];
  lesson_count?: number;
  quiz_count?: number;
  section_count?: number;
  topic_count?: number;
}

const COURSE_CONTENT_TYPES: ProductContentType[] = ['COURSE', 'MASTER_CLASS'];
const COURSE_WHERE = { contentType: { in: COURSE_CONTENT_TYPES }, deletedAt: null };

@Injectable()
export class CourseProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lessonRepository: LessonRepository,
    private readonly quizRepository: QuizRepository,
    private readonly sectionRepository: SectionRepository,
    private readonly topicRepository: TopicRepository,
  ) {}

  async createCourse(
    instructorId: string,
    input: {
      title: string;
      description?: string | undefined;
      thumbnailUrl?: string | undefined;
    },
  ): Promise<CourseProductRecord> {
    const id = generateUuidV7();
    const slug = await this.generateUniqueSlug(input.title);

    const product = await this.prisma.product.create({
      data: {
        id,
        productName: input.title,
        productSlug: slug,
        productDescription: input.description ?? null,
        thumbnailUrl: input.thumbnailUrl ?? null,
        contentType: 'COURSE',
        instructorId,
        amountCents: 0,
      },
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { lessons: true, quizzes: true } },
      },
    });

    return this.mapToRecord(product);
  }

  async getCourse(id: string): Promise<CourseProductRecord> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
        lessons: {
          orderBy: { sortOrder: 'asc' },
          include: {
            video: {
              select: { id: true, bunnyVideoId: true, title: true, thumbnailUrl: true, duration: true, bunnyLibraryType: true, videoStatus: true },
            },
          },
        },
        _count: { select: { lessons: true, quizzes: true, sections: true } },
      },
    });

    if (!product || product.deletedAt !== null || !COURSE_CONTENT_TYPES.includes(product.contentType)) {
      throw Errors.courseNotFound();
    }

    const sections = await this.sectionRepository.findByProductId(id);
    const record = this.mapToRecord(product);
    
    record.sections = sections;
    record.section_count = product._count?.sections ?? 0;

    return record;
  }

  async getCourseBySlug(slug: string): Promise<CourseProductRecord> {
    const product = await this.prisma.product.findFirst({
      where: { productSlug: slug, ...COURSE_WHERE },
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
        lessons: {
          orderBy: { sortOrder: 'asc' },
          include: {
            video: {
              select: { id: true, bunnyVideoId: true, title: true, thumbnailUrl: true, duration: true, bunnyLibraryType: true, videoStatus: true },
            },
          },
        },
        _count: { select: { lessons: true, quizzes: true, sections: true } },
      },
    });

    if (!product) {
      throw Errors.courseNotFound();
    }

    const sections = await this.sectionRepository.findByProductId(product.id);
    const record = this.mapToRecord(product);
    
    record.sections = sections;
    record.section_count = product._count?.sections ?? 0;

    return record;
  }

  async listCourses(params: {
    page: number;
    limit: number;
    instructorId?: string | undefined;
    isPublished?: boolean | undefined;
    language?: string | undefined;
  }): Promise<{ data: CourseProductRecord[]; total: number; page: number; limit: number }> {
    const skip = (params.page - 1) * params.limit;
    const where: Record<string, unknown> = { ...COURSE_WHERE };

    if (params.instructorId) {
      where.instructorId = params.instructorId;
    }

    if (params.isPublished !== undefined) {
      where.isPublished = params.isPublished;
    }

    if (params.language) {
      where.language = params.language;
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { lessons: true, quizzes: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products.map((p) => this.mapToRecord(p)),
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  async updateCourse(
    productId: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    input: {
      title?: string | undefined;
      description?: string | null | undefined;
      thumbnailUrl?: string | null | undefined;
      sortOrder?: number | undefined;
    },
  ): Promise<CourseProductRecord> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });

    if (!product || product.deletedAt !== null || !COURSE_CONTENT_TYPES.includes(product.contentType)) {
      throw Errors.courseNotFound();
    }

    if (admin.role === 'instructor' && product.instructorId !== admin.id) {
      throw Errors.insufficientRole();
    }

    const updateData: Record<string, unknown> = {};

    if (input.title !== undefined) {
      updateData.productName = input.title;
      updateData.productSlug = await this.generateUniqueSlug(input.title, productId);
    }

    if (input.description !== undefined) {
      updateData.productDescription = input.description;
    }

    if (input.thumbnailUrl !== undefined) {
      updateData.thumbnailUrl = input.thumbnailUrl;
    }

    if (input.sortOrder !== undefined) {
      updateData.sortOrder = input.sortOrder;
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { lessons: true, quizzes: true } },
      },
    });

    return this.mapToRecord(updated);
  }

  async deleteCourse(productId: string, admin: { id: string; role: 'admin' | 'instructor' }): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });

    if (!product || product.deletedAt !== null || !COURSE_CONTENT_TYPES.includes(product.contentType)) {
      throw Errors.courseNotFound();
    }

    if (admin.role === 'instructor' && product.instructorId !== admin.id) {
      throw Errors.insufficientRole();
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: { deletedAt: new Date() },
    });
  }

  async publishCourse(productId: string, admin: { id: string; role: 'admin' | 'instructor' }): Promise<CourseProductRecord> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });

    if (!product || product.deletedAt !== null || !COURSE_CONTENT_TYPES.includes(product.contentType)) {
      throw Errors.courseNotFound();
    }

    if (admin.role === 'instructor' && product.instructorId !== admin.id) {
      throw Errors.insufficientRole();
    }

    const published = await this.prisma.product.update({
      where: { id: productId },
      data: { isPublished: true, publishedAt: new Date() },
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { lessons: true, quizzes: true } },
      },
    });

    await this.sectionRepository.publishByProductId(productId);
    await this.lessonRepository.publishByProductId(productId);
    await this.topicRepository.publishByProductId(productId);
    await this.quizRepository.publishByProductId(productId);

    return this.mapToRecord(published);
  }

  async unpublishCourse(productId: string, admin: { id: string; role: 'admin' | 'instructor' }): Promise<CourseProductRecord> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });

    if (!product || product.deletedAt !== null || !COURSE_CONTENT_TYPES.includes(product.contentType)) {
      throw Errors.courseNotFound();
    }

    if (admin.role === 'instructor' && product.instructorId !== admin.id) {
      throw Errors.insufficientRole();
    }

    const unpublished = await this.prisma.product.update({
      where: { id: productId },
      data: { isPublished: false, publishedAt: null },
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { lessons: true, quizzes: true } },
      },
    });

    await this.sectionRepository.unpublishByProductId(productId);
    await this.lessonRepository.unpublishByProductId(productId);
    await this.topicRepository.unpublishByProductId(productId);
    await this.quizRepository.unpublishByProductId(productId);

    return this.mapToRecord(unpublished);
  }

  async getCourseForCustomer(slug: string, customerId: string | undefined): Promise<CourseProductRecord> {
    const product = await this.prisma.product.findFirst({
      where: { productSlug: slug, ...COURSE_WHERE, isPublished: true },
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
        lessons: {
          where: { isPublished: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            video: {
              select: { id: true, bunnyVideoId: true, title: true, thumbnailUrl: true, duration: true, bunnyLibraryType: true, videoStatus: true },
            },
          },
        },
        _count: { select: { lessons: true, quizzes: true, sections: true } },
      },
    });

    if (!product) {
      throw Errors.courseNotFound();
    }

    // Free course (amount is 0) — return with sections and full access
    if (Number(product.amountCents) === 0) {
      const sections = await this.sectionRepository.findByProductIdPublished(product.id);
      const record = this.mapToRecord(product);

      record.sections = sections;
      record.section_count = sections.length;
      record.has_access = true;
      record.stripe_price_id = product.stripePriceId ?? null;

      return record;
    }

    // Paid course — check access
    const hasAccess = customerId ? await this.checkAccess(customerId, product.id) : false;
    const record = this.mapToRecord(product);

    record.has_access = hasAccess;
    record.stripe_price_id = product.stripePriceId ?? null;

    if (hasAccess) {
      // Full access — include sections and lessons
      const sections = await this.sectionRepository.findByProductIdPublished(product.id);

      record.sections = sections;
      record.section_count = sections.length;
    } else {
      // No access — return metadata only, no content
      record.sections = [];
      record.lessons = [];
      record.section_count = product._count?.sections ?? 0;
    }

    return record;
  }

  async checkAccess(customerId: string, productId: string): Promise<boolean> {
    const result = await this.prisma.$queryRawUnsafe<Array<{ has_access: boolean }>>(
      'SELECT has_access($1::uuid, $2::uuid) as has_access',
      customerId,
      productId,
    );

    return result[0]?.has_access === true;
  }

  private async generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    let counter = 1;
    const maxIterations = 100;

    while (await this.slugExists(slug, excludeId)) {
      if (counter >= maxIterations) {
        const suffix = Math.random().toString(36).slice(2, 8);

        slug = `${baseSlug}-${suffix}`;
        break;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const product = await this.prisma.product.findFirst({
      where: { productSlug: slug, deletedAt: null },
    });

    if (!product) {
      return false;
    }

    if (excludeId && product.id === excludeId) {
      return false;
    }

    return true;
  }

  private mapToRecord(product: {
    id: string;
    productName: string;
    productSlug: string | null;
    productDescription: string | null;
    thumbnailUrl: string | null;
    amountCents: bigint;
    currency: string;
    language: string;
    contentType: string;
    instructorId: string | null;
    isPublished: boolean;
    publishedAt: Date | null;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    instructor?: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
    lessons?: Array<{
      id: string;
      productId: string;
      sectionId: string;
      title: string;
      content: string | null;
      videoId: string | null;
      lessonType: string;
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
        bunnyLibraryType: string;
        videoStatus: string;
      } | null;
    }>;
    _count?: { lessons: number; quizzes: number; sections?: number };
  }): CourseProductRecord {
    const LESSON_TYPE_MAP: Record<string, 'video' | 'text'> = { VIDEO: 'video', TEXT: 'text' };
    const LIBRARY_TYPE_MAP: Record<string, 'public' | 'private'> = { PUBLIC: 'public', PRIVATE: 'private' };
    const VIDEO_STATUS_MAP: Record<string, 'processing' | 'ready' | 'failed'> = { PROCESSING: 'processing', READY: 'ready', FAILED: 'failed' };
    const CONTENT_TYPE_MAP: Record<string, string> = {
      COURSE: 'course',
      MASTER_CLASS: 'master_class',
      BUNDLE: 'bundle',
      DIGITAL_DOWNLOAD: 'digital_download',
    };

    return {
      id: product.id,
      product_name: product.productName,
      product_slug: product.productSlug,
      product_description: product.productDescription,
      thumbnail_url: product.thumbnailUrl,
      amount_cents: Number(product.amountCents),
      currency: product.currency,
      language: product.language,
      content_type: CONTENT_TYPE_MAP[product.contentType] ?? 'course',
      instructor_id: product.instructorId,
      is_published: product.isPublished,
      published_at: product.publishedAt,
      sort_order: product.sortOrder,
      is_active: product.isActive,
      created_at: product.createdAt,
      updated_at: product.updatedAt,
      deleted_at: product.deletedAt,
      ...(product.instructor && {
        instructor: {
          id: product.instructor.id,
          first_name: product.instructor.firstName,
          last_name: product.instructor.lastName,
          email: product.instructor.email,
        },
      }),
      ...(product.lessons && {
        lessons: product.lessons.map((l) => ({
          id: l.id,
          product_id: l.productId,
          section_id: l.sectionId,
          title: l.title,
          content: l.content,
          video_id: l.videoId,
          lesson_type: (LESSON_TYPE_MAP[l.lessonType] ?? 'text') as 'video' | 'text',
          duration: l.duration,
          section_name: l.sectionName,
          sort_order: l.sortOrder,
          is_published: l.isPublished,
          created_at: l.createdAt,
          updated_at: l.updatedAt,
          ...(l.video && {
            video: {
              id: l.video.id,
              bunny_video_id: l.video.bunnyVideoId,
              title: l.video.title,
              thumbnail_url: l.video.thumbnailUrl,
              duration: l.video.duration,
              bunny_library_type: (LIBRARY_TYPE_MAP[l.video.bunnyLibraryType] ?? 'private') as 'public' | 'private',
              video_status: (VIDEO_STATUS_MAP[l.video.videoStatus] ?? 'processing') as 'processing' | 'ready' | 'failed',
            },
          }),
        })),
      }),
      ...(product._count && { lesson_count: product._count.lessons, quiz_count: product._count.quizzes }),
    };
  }
}
