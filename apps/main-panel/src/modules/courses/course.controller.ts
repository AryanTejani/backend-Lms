import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CourseProductService } from '@app/content/services/course-product.service';
import { LessonService } from '@app/content/services/lesson.service';
import { TopicService } from '@app/content/services/topic.service';
import { QuizService } from '@app/content/services/quiz.service';
import type { CourseProductRecord } from '@app/content/services/course-product.service';
import type { LessonRecord } from '@app/content/repositories/lesson.repository';
import type { TopicRecord } from '@app/content/repositories/topic.repository';
import type { QuizRecord } from '@app/content/repositories/quiz.repository';
import { Public } from '@app/shared/decorators/public.decorator';
import { OptionalSessionGuard } from '../../guards/session.guard';
import { CurrentUser, AuthenticatedUser } from '../../decorators/current-user.decorator';

@Controller('courses')
export class CourseController {
  constructor(
    private readonly courseProductService: CourseProductService,
    private readonly lessonService: LessonService,
    private readonly topicService: TopicService,
    private readonly quizService: QuizService,
  ) {}

  @Get()
  @Public()
  async list(@Query('language') language?: string): Promise<{ data: CourseProductRecord[]; total: number; page: number; limit: number }> {
    return this.courseProductService.listCourses({ page: 1, limit: 100, isPublished: true, language });
  }

  @Get(':slug')
  @Public()
  @UseGuards(OptionalSessionGuard)
  async findBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<CourseProductRecord> {
    return this.courseProductService.getCourseForCustomer(slug, user?.id);
  }

  @Get(':slug/lessons/:lessonId')
  @Public()
  @UseGuards(OptionalSessionGuard)
  async getLesson(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<LessonRecord & { embed_url?: string | undefined; video_status?: string | undefined }> {
    return this.lessonService.getLessonForCustomer(lessonId, user?.id);
  }

  @Get(':slug/topics/:topicId')
  @Public()
  @UseGuards(OptionalSessionGuard)
  async getTopic(
    @Param('topicId') topicId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<TopicRecord & { embed_url?: string | undefined; video_status?: string | undefined }> {
    return this.topicService.getTopicForCustomer(topicId, user?.id);
  }

  @Get(':slug/quizzes')
  @Public()
  @UseGuards(OptionalSessionGuard)
  async listQuizzes(
    @Param('slug') slug: string,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<QuizRecord[]> {
    const course = await this.courseProductService.getCourseForCustomer(slug, user?.id);

    return this.quizService.listQuizzesForCustomer(course.id);
  }

  @Get(':slug/quizzes/:quizId')
  @Public()
  @UseGuards(OptionalSessionGuard)
  async getQuiz(
    @Param('quizId') quizId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<QuizRecord> {
    return this.quizService.getQuizForCustomer(quizId, user?.id);
  }
}
