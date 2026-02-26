import { Module } from '@nestjs/common';
import { CustomerModule } from '@app/customer';
import { BillingModule } from '@app/billing';
import { CustomerController } from './controllers/customer.controller';

@Module({
  imports: [CustomerModule, BillingModule],
  controllers: [CustomerController],
})
export class CustomersModule {}
