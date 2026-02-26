import { Controller, Get } from '@nestjs/common';
import { TagService } from '@app/content/services/tag.service';
import { TagRecord } from '@app/content/repositories/tag.repository';

@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  async findAll(): Promise<TagRecord[]> {
    return this.tagService.listTags();
  }
}
