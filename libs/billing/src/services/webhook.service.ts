import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { generateUuidV7 } from '@app/shared/utils/uuid.util';
import { StripeService } from './stripe.service';
import { SubscriptionPlanRepository } from '../repositories/subscription-plan.repository';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { OrderRepository } from '../repositories/order.repository';
import type Stripe from 'stripe';
import type { SubscriptionStatus } from '@prisma/client';

const STRIPE_STATUS_MAP: Record<string, SubscriptionStatus> = {
  trialing: 'TRIALING',
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  paused: 'PAUSED',
};

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
    private readonly subscriptionPlanRepository: SubscriptionPlanRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly orderRepository: OrderRepository,
  ) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'charge.refunded':
        await this.handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        this.logger.debug(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    if (session.mode === 'payment') {
      await this.handleOneTimePaymentCheckout(session);

      return;
    }

    if (session.mode !== 'subscription' || !session.subscription) {
      return;
    }

    const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;

    // Idempotency: check if we already processed this subscription
    const existing = await this.subscriptionRepository.findByStripeSubscriptionId(stripeSubscriptionId);

    if (existing) {
      this.logger.debug(`Subscription ${stripeSubscriptionId} already exists, skipping`);

      return;
    }

    // Get the full subscription from Stripe
    const stripeSubscription = await this.stripeService.retrieveSubscription(stripeSubscriptionId);
    const stripeCustomerId = typeof stripeSubscription.customer === 'string' ? stripeSubscription.customer : stripeSubscription.customer.id;

    // Find our customer by Stripe customer ID
    const customer = await this.prisma.customer.findFirst({
      where: { stripeCustomerId },
    });

    if (!customer) {
      this.logger.error(`No customer found for Stripe customer ${stripeCustomerId}`);

      return;
    }

    // Get the price ID from the subscription item to find our plan
    const firstItem = stripeSubscription.items.data[0];

    if (!firstItem) {
      this.logger.error(`Subscription ${stripeSubscriptionId} has no items`);

      return;
    }

    const stripePriceId = firstItem.price.id;
    const plan = await this.subscriptionPlanRepository.findByStripePriceId(stripePriceId);

    const status = STRIPE_STATUS_MAP[stripeSubscription.status] ?? 'ACTIVE';

    // In the new API, current_period_start/end are on the subscription item, not the subscription
    const periodStart = firstItem.current_period_start;
    const periodEnd = firstItem.current_period_end;

    // Create Subscription record, Purchase records, and increment customer count atomically
    const subscription = await this.prisma.$transaction(async (tx) => {
      const createdSubscription = await this.subscriptionRepository.create({
        customerId: customer.id,
        planId: plan?.id ?? null,
        status,
        currency: stripeSubscription.currency,
        unitAmountCents: BigInt(firstItem.price.unit_amount ?? 0),
        recurringInterval: firstItem.price.recurring?.interval ?? 'month',
        recurringIntervalCount: firstItem.price.recurring?.interval_count ?? 1,
        currentPeriodStart: new Date(periodStart * 1000),
        currentPeriodEnd: new Date(periodEnd * 1000),
        stripeSubscriptionId,
        trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : undefined,
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : undefined,
      });

      // Create Purchase records for each product linked to the plan
      if (plan) {
        const planProducts = await tx.subscriptionPlanProduct.findMany({
          where: { planId: plan.id },
        });

        for (const planProduct of planProducts) {
          await tx.purchase.create({
            data: {
              id: generateUuidV7(),
              customerId: customer.id,
              productId: planProduct.productId,
              subscriptionId: createdSubscription.id,
              unitAmountCents: BigInt(plan.amount_cents),
              currency: plan.currency,
              status: 'ACTIVE',
            },
          });
        }
      }

      // Increment customer's active subscription count
      await tx.customer.update({
        where: { id: customer.id },
        data: { activeSubscriptions: { increment: 1 } },
      });

      return createdSubscription;
    });

    this.logger.log(`Created subscription ${subscription.id} for customer ${customer.id}`);
  }

  private async handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription): Promise<void> {
    const status = STRIPE_STATUS_MAP[stripeSubscription.status];

    if (!status) {
      this.logger.warn(`Unknown Stripe subscription status: ${stripeSubscription.status}`);

      return;
    }

    // In the new API, period dates are on subscription items
    const firstItem = stripeSubscription.items.data[0];
    const periodStart = firstItem ? new Date(firstItem.current_period_start * 1000) : undefined;
    const periodEnd = firstItem ? new Date(firstItem.current_period_end * 1000) : undefined;

    await this.subscriptionRepository.updateByStripeSubscriptionId(stripeSubscription.id, {
      status,
      ...(periodStart !== undefined && { currentPeriodStart: periodStart }),
      ...(periodEnd !== undefined && { currentPeriodEnd: periodEnd }),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
    });

    this.logger.log(`Updated subscription ${stripeSubscription.id} to status ${status}`);
  }

  private async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
    const existing = await this.subscriptionRepository.findByStripeSubscriptionId(stripeSubscription.id);

    if (!existing) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // Mark subscription as canceled
      await this.subscriptionRepository.updateByStripeSubscriptionId(stripeSubscription.id, {
        status: 'CANCELED',
        canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : new Date(),
        endedAt: new Date(),
      });

      // Revoke associated purchases
      await tx.purchase.updateMany({
        where: {
          subscriptionId: existing.id,
          status: 'ACTIVE',
        },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revokeReason: 'Subscription canceled',
        },
      });

      // Decrement customer's active subscription count
      await tx.customer.update({
        where: { id: existing.customer_id },
        data: {
          activeSubscriptions: { decrement: 1 },
        },
      });
    });

    this.logger.log(`Canceled subscription ${stripeSubscription.id} for customer ${existing.customer_id}`);
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.id) {
      return;
    }

    // Idempotency: check if order already exists
    const existingOrder = await this.orderRepository.findByStripeInvoiceId(invoice.id);

    if (existingOrder) {
      this.logger.debug(`Order for invoice ${invoice.id} already exists, skipping`);

      return;
    }

    const stripeCustomerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

    if (!stripeCustomerId) {
      return;
    }

    const customer = await this.prisma.customer.findFirst({
      where: { stripeCustomerId },
    });

    if (!customer) {
      this.logger.error(`No customer found for Stripe customer ${stripeCustomerId}`);

      return;
    }

    // Compute tax from total_taxes
    const totalTaxCents = invoice.total_taxes?.reduce((sum: number, t: { amount: number }) => sum + t.amount, 0) ?? 0;

    const order = await this.prisma.$transaction(async (tx) => {
      const createdOrder = await this.orderRepository.create({
        customerId: customer.id,
        orderType: 'SUBSCRIPTION',
        currency: invoice.currency ?? 'inr',
        subtotalCents: BigInt(invoice.subtotal ?? 0),
        discountCents: BigInt(invoice.total_discount_amounts?.reduce((sum: number, d: { amount: number }) => sum + d.amount, 0) ?? 0),
        taxCents: BigInt(totalTaxCents),
        totalCents: BigInt(invoice.total ?? 0),
        amountDueCents: BigInt(invoice.amount_due ?? 0),
        stripeInvoiceId: invoice.id,
        paidAt: new Date(),
        status: 'PAID',
      });

      // Create order items from invoice line items
      for (const lineItem of invoice.lines?.data ?? []) {
        // In new API: pricing.price_details.price for the price reference
        const pricing = lineItem.pricing;
        const priceRef = pricing?.price_details?.price;
        const stripePriceId = typeof priceRef === 'object' ? priceRef?.id : typeof priceRef === 'string' ? priceRef : null;
        let productId: string | undefined;

        if (stripePriceId) {
          const plan = await this.subscriptionPlanRepository.findByStripePriceId(stripePriceId);

          if (plan) {
            const planProducts = await tx.subscriptionPlanProduct.findMany({
              where: { planId: plan.id },
            });

            const firstProduct = planProducts[0];

            if (firstProduct) {
              productId = firstProduct.productId;
            }
          }
        }

        if (productId) {
          // Find the subscription for this invoice line item
          const lineParent = lineItem.parent;
          const subItemDetails = lineParent?.subscription_item_details;
          const stripeSubId = subItemDetails?.subscription ?? null;
          let subscriptionId: string | null = null;

          if (stripeSubId) {
            const sub = await this.subscriptionRepository.findByStripeSubscriptionId(stripeSubId);

            if (sub) {
              subscriptionId = sub.id;
            }
          }

          // Compute line-level tax from taxes array
          const lineTaxCents = lineItem.taxes?.reduce((sum: number, t: { amount: number }) => sum + t.amount, 0) ?? 0;

          await this.orderRepository.createOrderItem({
            orderId: createdOrder.id,
            orderYear: createdOrder.created_year,
            productId,
            quantity: lineItem.quantity ?? 1,
            unitAmountCents: BigInt(lineItem.amount),
            discountCents: BigInt(0),
            taxCents: BigInt(lineTaxCents),
            totalCents: BigInt(lineItem.amount),
            currency: lineItem.currency,
            ...(subscriptionId !== null && { subscriptionId }),
          });
        }
      }

      // Update customer totals
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          totalOrders: { increment: 1 },
          totalSpentCents: { increment: BigInt(invoice.total ?? 0) },
        },
      });

      return createdOrder;
    });

    this.logger.log(`Created order ${order.order_number} for invoice ${invoice.id}`);
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.id) {
      return;
    }

    const existingOrder = await this.orderRepository.findByStripeInvoiceId(invoice.id);

    if (existingOrder) {
      await this.orderRepository.updateStatus(existingOrder.id, existingOrder.created_year, 'PAYMENT_FAILED');
      this.logger.warn(`Updated order ${existingOrder.order_number} to PAYMENT_FAILED for invoice ${invoice.id}`);
    } else {
      this.logger.warn(`Invoice payment failed for ${invoice.id}, no existing order found`);
    }
  }

  private async handleOneTimePaymentCheckout(session: Stripe.Checkout.Session): Promise<void> {
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;

    if (!paymentIntentId) {
      this.logger.error('One-time payment checkout has no payment_intent');

      return;
    }

    // Idempotency check
    const existingOrder = await this.orderRepository.findByStripePaymentIntentId(paymentIntentId);

    if (existingOrder) {
      this.logger.debug(`Order for payment intent ${paymentIntentId} already exists, skipping`);

      return;
    }

    const customerId = session.metadata?.traderlion_customer_id;
    const productId = session.metadata?.traderlion_product_id;

    if (!customerId || !productId) {
      this.logger.error('One-time payment checkout missing metadata (customer_id or product_id)');

      return;
    }

    const amountTotal = session.amount_total ?? 0;

    const order = await this.prisma.$transaction(async (tx) => {
      // Create Order
      const createdOrder = await this.orderRepository.create({
        customerId,
        orderType: 'CHECKOUT',
        currency: session.currency ?? 'inr',
        subtotalCents: BigInt(amountTotal),
        discountCents: BigInt(0),
        taxCents: BigInt(0),
        totalCents: BigInt(amountTotal),
        amountDueCents: BigInt(amountTotal),
        stripePaymentIntentId: paymentIntentId,
        paidAt: new Date(),
        status: 'PAID',
      });

      // Create OrderItem
      await this.orderRepository.createOrderItem({
        orderId: createdOrder.id,
        orderYear: createdOrder.created_year,
        productId,
        quantity: 1,
        unitAmountCents: BigInt(amountTotal),
        discountCents: BigInt(0),
        taxCents: BigInt(0),
        totalCents: BigInt(amountTotal),
        currency: session.currency ?? 'inr',
      });

      // Create Purchase (lifetime)
      await tx.purchase.create({
        data: {
          id: generateUuidV7(),
          customerId,
          productId,
          orderId: createdOrder.id,
          unitAmountCents: BigInt(amountTotal),
          currency: session.currency ?? 'inr',
          status: 'ACTIVE',
          isLifetime: true,
        },
      });

      // Update customer totals
      await tx.customer.update({
        where: { id: customerId },
        data: {
          totalOrders: { increment: 1 },
          totalSpentCents: { increment: BigInt(amountTotal) },
        },
      });

      return createdOrder;
    });

    this.logger.log(`Created one-time purchase order ${order.order_number} for customer ${customerId}, product ${productId}`);
  }

  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;

    if (!paymentIntentId) {
      this.logger.warn('charge.refunded event has no payment_intent');

      return;
    }

    const order = await this.orderRepository.findByStripePaymentIntentId(paymentIntentId);

    if (!order) {
      this.logger.warn(`No order found for payment intent ${paymentIntentId} in charge.refunded`);

      return;
    }

    const amountRefunded = charge.amount_refunded;
    const isFullRefund = amountRefunded >= order.total_cents;

    const newStatus = isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    await this.prisma.$transaction(async (tx) => {
      await this.orderRepository.updateRefund(order.id, order.created_year, {
        status: newStatus,
        refundAmountCents: amountRefunded,
        refundReason: 'Refunded via Stripe dashboard',
      });

      if (isFullRefund) {
        // Revoke all purchases linked to this order
        await tx.purchase.updateMany({
          where: {
            orderId: order.id,
            status: 'ACTIVE',
          },
          data: {
            status: 'REVOKED',
            revokedAt: new Date(),
            revokeReason: 'Full refund issued',
          },
        });

        // Decrement customer total spent
        await tx.customer.update({
          where: { id: order.customer_id },
          data: {
            totalSpentCents: { decrement: BigInt(order.total_cents) },
          },
        });
      }
    });

    this.logger.log(`Processed charge.refunded for order ${order.order_number}: ${newStatus}`);
  }
}
