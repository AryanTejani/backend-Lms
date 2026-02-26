import { Module } from '@nestjs/common';
import { ContentModule } from '@app/content';
import { BillingModule } from '@app/billing';
import { CourseController } from './controllers/course.controller';
import { SectionController } from './controllers/section.controller';
import { LessonController } from './controllers/lesson.controller';
import { TopicController } from './controllers/topic.controller';
import { QuizController } from './controllers/quiz.controller';

@Module({
  imports: [ContentModule, BillingModule],
  controllers: [CourseController, SectionController, LessonController, TopicController, QuizController],
})
export class CoursesModule {}
