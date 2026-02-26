import { Controller, Post, Get, Patch, Put, Delete, Param, Body } from '@nestjs/common';
import { TopicService } from '@app/content/services/topic.service';
import type { TopicRecord } from '@app/content/repositories/topic.repository';
import { ZodValidationPipe } from '@app/shared/pipes/zod-validation.pipe';
import { CurrentAdmin, AuthenticatedAdmin } from '../../../decorators/current-admin.decorator';
import { createTopicSchema, updateTopicSchema, reorderTopicsSchema } from '../schemas/topic.schema';
import type { CreateTopicInput, UpdateTopicInput, ReorderTopicsInput } from '../schemas/topic.schema';

@Controller('courses/:productId/topics')
export class TopicController {
  constructor(private readonly topicService: TopicService) {}

  @Post()
  async create(
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(createTopicSchema)) body: CreateTopicInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<TopicRecord> {
    return this.topicService.addTopic(productId, admin, {
      title: body.title,
      topicType: body.topic_type,
      lessonId: body.lesson_id,
      sectionId: body.section_id,
      content: body.content,
      videoId: body.video_id,
      duration: body.duration,
    });
  }

  @Get()
  async findAll(@Param('productId') productId: string): Promise<TopicRecord[]> {
    return this.topicService.listTopics(productId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<TopicRecord> {
    return this.topicService.getTopic(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTopicSchema)) body: UpdateTopicInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<TopicRecord> {
    return this.topicService.updateTopic(id, admin, {
      title: body.title,
      content: body.content,
      videoId: body.video_id,
      topicType: body.topic_type,
      duration: body.duration,
      lessonId: body.lesson_id,
      isPublished: body.is_published,
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin): Promise<{ success: boolean }> {
    await this.topicService.removeTopic(id, admin);

    return { success: true };
  }

  @Put('reorder')
  async reorder(
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(reorderTopicsSchema)) body: ReorderTopicsInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<TopicRecord[]> {
    return this.topicService.reorderTopics(productId, admin, body.topic_ids);
  }
}
