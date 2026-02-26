import { Controller, Post, Get, Patch, Put, Delete, Param, Body } from '@nestjs/common';
import { LessonService } from '@app/content/services/lesson.service';
import type { LessonRecord } from '@app/content/repositories/lesson.repository';
import { ZodValidationPipe } from '@app/shared/pipes/zod-validation.pipe';
import { CurrentAdmin, AuthenticatedAdmin } from '../../../decorators/current-admin.decorator';
import { createLessonSchema, updateLessonSchema, reorderLessonsSchema } from '../schemas/lesson.schema';
import type { CreateLessonInput, UpdateLessonInput, ReorderLessonsInput } from '../schemas/lesson.schema';

@Controller('courses/:productId/lessons')
export class LessonController {
  constructor(private readonly lessonService: LessonService) {}

  @Post()
  async create(
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(createLessonSchema)) body: CreateLessonInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<LessonRecord> {
    return this.lessonService.addLesson(productId, admin, {
      title: body.title,
      lessonType: body.lesson_type,
      sectionId: body.section_id,
      content: body.content,
      videoId: body.video_id,
      duration: body.duration,
    });
  }

  @Get()
  async findAll(@Param('productId') productId: string): Promise<LessonRecord[]> {
    return this.lessonService.listLessons(productId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<LessonRecord> {
    return this.lessonService.getLesson(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateLessonSchema)) body: UpdateLessonInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<LessonRecord> {
    return this.lessonService.updateLesson(id, admin, {
      title: body.title,
      content: body.content,
      videoId: body.video_id,
      lessonType: body.lesson_type,
      duration: body.duration,
      sectionId: body.section_id,
      isPublished: body.is_published,
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin): Promise<{ success: boolean }> {
    await this.lessonService.removeLesson(id, admin);

    return { success: true };
  }

  @Put('reorder')
  async reorder(
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(reorderLessonsSchema)) body: ReorderLessonsInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<LessonRecord[]> {
    return this.lessonService.reorderLessons(productId, admin, body.lesson_ids);
  }
}
