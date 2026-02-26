import { Module } from '@nestjs/common';
import { ContentModule } from '@app/content';
import { AuthHttpModule } from '../auth/auth.module';
import { VideoController } from './video.controller';

@Module({
  imports: [ContentModule, AuthHttpModule],
  controllers: [VideoController],
})
export class VideosModule {}
