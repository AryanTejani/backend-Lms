import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/shared/prisma/prisma.module';
import { ProductRepository } from './repositories/product.repository';
import { ProductService } from './services/product.service';
import { SubscriptionPlanRepository } from './repositories/subscription-plan.repository';
import { SubscriptionRepository } from './repositories/subscription.repository';
import { OrderRepository } from './repositories/order.repository';
import { SubscriptionPlanService } from './services/subscription-plan.service';
import { StripeService } from './services/stripe.service';
import { CheckoutService } from './services/checkout.service';
import { WebhookService } from './services/webhook.service';
import { CourseStripeSyncService } from './services/course-stripe-sync.service';
import { RefundService } from './services/refund.service';
import { SubscriptionManagementService } from './services/subscription-management.service';

@Module({
  imports: [PrismaModule],
  providers: [
    ProductRepository,
    ProductService,
    SubscriptionPlanRepository,
    SubscriptionPlanService,
    SubscriptionRepository,
    OrderRepository,
    StripeService,
    CheckoutService,
    WebhookService,
    CourseStripeSyncService,
    RefundService,
    SubscriptionManagementService,
  ],
  exports: [
    ProductRepository,
    ProductService,
    SubscriptionPlanRepository,
    SubscriptionPlanService,
    SubscriptionRepository,
    OrderRepository,
    StripeService,
    CheckoutService,
    WebhookService,
    CourseStripeSyncService,
    RefundService,
    SubscriptionManagementService,
  ],
})
export class BillingModule {}
