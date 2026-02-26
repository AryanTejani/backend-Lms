import { Injectable } from '@nestjs/common';
import { TagRepository, TagRecord } from '../repositories/tag.repository';

@Injectable()
export class TagService {
  constructor(private readonly tagRepository: TagRepository) {}

  async listTags(): Promise<TagRecord[]> {
    return this.tagRepository.findAll();
  }

  async getTag(id: string): Promise<TagRecord | null> {
    return this.tagRepository.findById(id);
  }
}
