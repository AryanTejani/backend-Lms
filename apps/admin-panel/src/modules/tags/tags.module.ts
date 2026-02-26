import { Module } from '@nestjs/common';
import { ContentModule } from '@app/content';
import { TagController } from './tag.controller';

@Module({
  imports: [ContentModule],
  controllers: [TagController],
})
export class TagsModule {}
