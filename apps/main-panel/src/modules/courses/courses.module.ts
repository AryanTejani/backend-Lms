import { Module } from '@nestjs/common';
import { ContentModule } from '@app/content';
import { AuthHttpModule } from '../auth/auth.module';
import { CourseController } from './course.controller';

@Module({
  imports: [ContentModule, AuthHttpModule],
  controllers: [CourseController],
})
export class CoursesModule {}
