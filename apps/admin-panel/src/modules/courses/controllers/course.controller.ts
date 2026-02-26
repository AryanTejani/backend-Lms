import { Controller, Post, Get, Patch, Delete, Param, Body, Query, Logger } from '@nestjs/common';
import { CourseProductService } from '@app/content/services/course-product.service';
import type { CourseProductRecord } from '@app/content/services/course-product.service';
import { CourseStripeSyncService } from '@app/billing/services/course-stripe-sync.service';
import { ZodValidationPipe } from '@app/shared/pipes/zod-validation.pipe';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { CurrentAdmin, AuthenticatedAdmin } from '../../../decorators/current-admin.decorator';
import { createCourseSchema, updateCourseSchema } from '../schemas/course.schema';
import type { CreateCourseInput, UpdateCourseInput } from '../schemas/course.schema';

@Controller('courses')
export class CourseController {
  private readonly logger = new Logger(CourseController.name);

  constructor(
    private readonly courseProductService: CourseProductService,
    private readonly courseStripeSyncService: CourseStripeSyncService,
  ) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createCourseSchema)) body: CreateCourseInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<CourseProductRecord> {
    return this.courseProductService.createCourse(admin.id, {
      title: body.title,
      description: body.description,
      thumbnailUrl: body.thumbnail_url,
    });
  }

  @Get()
  async findAll(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('published') published?: string,
  ): Promise<{ data: CourseProductRecord[]; total: number; page: number; limit: number }> {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));

    const instructorId = admin.role === 'instructor' ? admin.id : undefined;
    const isPublished = published === 'true' ? true : published === 'false' ? false : undefined;

    return this.courseProductService.listCourses({ page: pageNum, limit: limitNum, instructorId, isPublished });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin): Promise<CourseProductRecord> {
    const course = await this.courseProductService.getCourse(id);

    if (admin.role === 'instructor' && course.instructor_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    return course;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCourseSchema)) body: UpdateCourseInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<CourseProductRecord> {
    return this.courseProductService.updateCourse(id, admin, {
      title: body.title,
      description: body.description,
      thumbnailUrl: body.thumbnail_url,
      sortOrder: body.sort_order,
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin): Promise<{ success: boolean }> {
    await this.courseProductService.deleteCourse(id, admin);

    return { success: true };
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin): Promise<CourseProductRecord> {
    const course = await this.courseProductService.publishCourse(id, admin);

    // Sync to Stripe if paid course without Stripe price
    if (course.amount_cents > 0) {
      try {
        await this.courseStripeSyncService.syncProductToStripe(id);
      } catch (error) {
        this.logger.error(`Failed to sync course ${id} to Stripe on publish`, error);
      }
    }

    return course;
  }

  @Post(':id/unpublish')
  async unpublish(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin): Promise<CourseProductRecord> {
    return this.courseProductService.unpublishCourse(id, admin);
  }
}
