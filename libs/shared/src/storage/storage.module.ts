import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';
import { VideoService } from './video.service';

@Global()
@Module({
  providers: [StorageService, VideoService],
  exports: [StorageService, VideoService],
})
export class StorageModule {}
