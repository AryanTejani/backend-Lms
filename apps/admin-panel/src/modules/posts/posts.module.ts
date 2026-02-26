import { Module } from '@nestjs/common';
import { ContentModule } from '@app/content';
import { PostController } from './controllers/post.controller';
import { UploadController } from './controllers/upload.controller';

@Module({
  imports: [ContentModule],
  controllers: [PostController, UploadController],
})
export class PostsModule {}
