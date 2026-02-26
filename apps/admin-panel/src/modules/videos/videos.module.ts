import { Module } from '@nestjs/common';
import { ContentModule } from '@app/content';
import { VideoController } from './video.controller';

@Module({
  imports: [ContentModule],
  controllers: [VideoController],
})
export class VideosModule {}
