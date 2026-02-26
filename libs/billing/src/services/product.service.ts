import { Injectable } from '@nestjs/common';
import { ProductRepository, ProductRecord } from '../repositories/product.repository';

@Injectable()
export class ProductService {
  constructor(private readonly productRepository: ProductRepository) {}

  async listProducts(contentType?: string): Promise<ProductRecord[]> {
    return this.productRepository.findAll({
      ...(contentType !== undefined && { contentType }),
      isActive: true,
    });
  }
}
