import { Module } from '@nestjs/common';
import { BillingModule } from '@app/billing';
import { ProductController } from './controllers/product.controller';

@Module({
  imports: [BillingModule],
  controllers: [ProductController],
})
export class ProductsModule {}
