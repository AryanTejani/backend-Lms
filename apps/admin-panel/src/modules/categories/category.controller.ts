import { Controller, Get } from '@nestjs/common';
import { CategoryService } from '@app/content/services/category.service';
import { CategoryRecord } from '@app/content/repositories/category.repository';

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  async findAll(): Promise<CategoryRecord[]> {
    return this.categoryService.listCategories();
  }
}
