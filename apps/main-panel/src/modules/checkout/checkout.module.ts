import { Module } from '@nestjs/common';
import { BillingModule } from '@app/billing';
import { AuthHttpModule } from '../auth/auth.module';
import { CheckoutController } from './controllers/checkout.controller';

@Module({
  imports: [BillingModule, AuthHttpModule],
  controllers: [CheckoutController],
})
export class CheckoutModule {}
