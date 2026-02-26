import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { StripeService } from './stripe.service';
import { SubscriptionRepository } from '../repositories/subscription.repository';

@Injectable()
export class SubscriptionManagementService {
  private readonly logger = new Logger(SubscriptionManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly subscriptionRepository: SubscriptionRepository,
  ) {}

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean, reason?: string): Promise<void> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);

    if (!subscription) {
      throw Errors.subscriptionNotFound();
    }

    if (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIALING') {
      throw Errors.subscriptionNotCancellable('Subscription is not active or trialing');
    }

    if (!subscription.stripe_subscription_id) {
      throw Errors.subscriptionNotCancellable('Subscription has no Stripe subscription linked');
    }

    try {
      await this.stripeService.cancelSubscription(subscription.stripe_subscription_id, cancelAtPeriodEnd);
    } catch (error) {
      this.logger.error(`Stripe subscription cancellation failed for ${subscriptionId}`, error);
      throw Errors.subscriptionCancelFailed('Stripe cancellation request failed');
    }

    if (cancelAtPeriodEnd) {
      await this.subscriptionRepository.updateByStripeSubscriptionId(subscription.stripe_subscription_id, {
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
      });

      this.logger.log(`Subscription ${subscriptionId} set to cancel at period end`);
    } else {
      await this.subscriptionRepository.updateByStripeSubscriptionId(subscription.stripe_subscription_id, {
        status: 'CANCELED',
        canceledAt: new Date(),
        endedAt: new Date(),
      });

      // Revoke associated purchases
      await this.prisma.purchase.updateMany({
        where: {
          subscriptionId: subscription.id,
          status: 'ACTIVE',
        },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revokeReason: reason ?? 'Subscription canceled by admin',
        },
      });

      // Decrement customer's active subscription count
      await this.prisma.customer.update({
        where: { id: subscription.customer_id },
        data: {
          activeSubscriptions: { decrement: 1 },
        },
      });

      this.logger.log(`Subscription ${subscriptionId} canceled immediately for customer ${subscription.customer_id}`);
    }
  }
}
