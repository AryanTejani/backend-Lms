import { Module } from '@nestjs/common';
import { ContentModule } from '@app/content';
import { CategoryController } from './category.controller';

@Module({
  imports: [ContentModule],
  controllers: [CategoryController],
})
export class CategoriesModule {}
