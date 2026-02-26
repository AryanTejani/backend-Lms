import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CourseProductService, CourseProductRecord } from '@app/content/services/course-product.service';
import { LessonService } from '@app/content/services/lesson.service';
import { TopicService } from '@app/content/services/topic.service';
import { Public } from '@app/shared/decorators/public.decorator';
import { SessionGuard, OptionalSessionGuard } from '../../guards/session.guard';
import { CurrentUser, AuthenticatedUser } from '../../decorators/current-user.decorator';

@Controller('courses')
@UseGuards(OptionalSessionGuard)
export class MobileContentController {
    constructor(
        private readonly courseProductService: CourseProductService,
        private readonly lessonService: LessonService,
        private readonly topicService: TopicService,
    ) { }

    @Get()
    @Public()
    async list(): Promise<{ data: CourseProductRecord[]; total: number }> {
        const result = await this.courseProductService.listCourses({ page: 1, limit: 100, isPublished: true });
        return { data: result.data, total: result.total };
    }

    @Get(':slug')
    async getCourse(@Param('slug') slug: string, @CurrentUser() user?: AuthenticatedUser): Promise<CourseProductRecord> {
        return this.courseProductService.getCourseForCustomer(slug, user?.id);
    }

    @Get(':slug/lessons/:lessonId')
    async getLesson(@Param('lessonId') lessonId: string, @CurrentUser() user?: AuthenticatedUser) {
        return this.lessonService.getLessonForCustomer(lessonId, user?.id);
    }
}
