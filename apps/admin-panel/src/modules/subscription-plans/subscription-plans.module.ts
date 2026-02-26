import { Module } from '@nestjs/common';
import { BillingModule } from '@app/billing';
import { SubscriptionPlanController } from './controllers/subscription-plan.controller';

@Module({
  imports: [BillingModule],
  controllers: [SubscriptionPlanController],
})
export class SubscriptionPlansModule {}
