import { Module } from '@nestjs/common';
import { PrismaModule, StorageModule } from '@app/shared';
import { PostRepository } from './repositories/post.repository';
import { PostService } from './services/post.service';
import { CategoryRepository } from './repositories/category.repository';
import { CategoryService } from './services/category.service';
import { TagRepository } from './repositories/tag.repository';
import { TagService } from './services/tag.service';
import { VideoRepository } from './repositories/video.repository';
import { VideoContentService } from './services/video-content.service';
import { LessonRepository } from './repositories/lesson.repository';
import { SectionRepository } from './repositories/section.repository';
import { TopicRepository } from './repositories/topic.repository';
import { CourseProductService } from './services/course-product.service';
import { LessonService } from './services/lesson.service';
import { TopicService } from './services/topic.service';
import { SectionService } from './services/section.service';
import { QuizRepository } from './repositories/quiz.repository';
import { QuizService } from './services/quiz.service';

@Module({
  imports: [PrismaModule, StorageModule],
  providers: [
    PostRepository, PostService,
    CategoryRepository, CategoryService,
    TagRepository, TagService,
    VideoRepository, VideoContentService,
    LessonRepository,
    SectionRepository, SectionService,
    TopicRepository, TopicService,
    CourseProductService, LessonService,
    QuizRepository, QuizService,
  ],
  exports: [
    PostRepository, PostService,
    CategoryRepository, CategoryService,
    TagRepository, TagService,
    VideoRepository, VideoContentService,
    LessonRepository,
    SectionRepository, SectionService,
    TopicRepository, TopicService,
    CourseProductService, LessonService,
    QuizRepository, QuizService,
  ],
})
export class ContentModule {}
