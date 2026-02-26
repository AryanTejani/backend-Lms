import { Injectable } from '@nestjs/common';
import { CategoryRepository, CategoryRecord } from '../repositories/category.repository';

@Injectable()
export class CategoryService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async listCategories(): Promise<CategoryRecord[]> {
    return this.categoryRepository.findAll();
  }

  async getCategory(id: string): Promise<CategoryRecord | null> {
    return this.categoryRepository.findById(id);
  }
}
