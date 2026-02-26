import { Controller, Get, Query } from '@nestjs/common';
import { ProductService } from '@app/billing/services/product.service';
import type { ProductRecord } from '@app/billing/repositories/product.repository';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  async findAll(@Query('content_type') contentType?: string): Promise<ProductRecord[]> {
    return this.productService.listProducts(contentType);
  }
}
