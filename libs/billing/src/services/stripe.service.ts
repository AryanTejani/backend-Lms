import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('stripe.secretKey');

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    });
  }

  async createCustomer(email: string, name?: string): Promise<Stripe.Customer> {
    return this.stripe.customers.create({
      email,
      ...(name !== undefined && { name }),
    });
  }

  async createCheckoutSession(params: {
    stripeCustomerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    promotionCode?: string;
  }): Promise<Stripe.Checkout.Session> {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: params.stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    };

    if (params.promotionCode) {
      // When a specific promotion code is provided, look it up and apply as discount
      const promotionCodes = await this.stripe.promotionCodes.list({
        code: params.promotionCode,
        active: true,
        limit: 1,
      });

      const promoCode = promotionCodes.data[0];

      if (promoCode) {
        sessionParams.discounts = [{ promotion_code: promoCode.id }];
      } else {
        // If code not found, allow manual entry on checkout page
        sessionParams.allow_promotion_codes = true;
      }
    } else {
      sessionParams.allow_promotion_codes = true;
    }

    return this.stripe.checkout.sessions.create(sessionParams);
  }

  async createPortalSession(stripeCustomerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    return this.stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });
  }

  async listActivePrices(): Promise<Stripe.Price[]> {
    const prices = await this.stripe.prices.list({
      active: true,
      type: 'recurring',
      expand: ['data.product'],
    });

    return prices.data;
  }

  async constructWebhookEvent(payload: Buffer, signature: string): Promise<Stripe.Event> {
    const webhookSecret = this.configService.get<string>('stripe.webhookSecret');

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  async retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price.product'],
    });
  }

  async createProduct(params: { name: string; description?: string; metadata?: Record<string, string> }): Promise<Stripe.Product> {
    return this.stripe.products.create({
      name: params.name,
      ...(params.description && { description: params.description }),
      ...(params.metadata !== undefined && { metadata: params.metadata }),
    });
  }

  async updateProduct(productId: string, params: { name?: string; description?: string }): Promise<Stripe.Product> {
    return this.stripe.products.update(productId, {
      ...(params.name !== undefined && { name: params.name }),
      ...(params.description !== undefined && { description: params.description }),
    });
  }

  async createPrice(params: {
    productId: string;
    unitAmount: number;
    currency: string;
    recurringInterval: Stripe.PriceCreateParams.Recurring.Interval;
    recurringIntervalCount?: number;
  }): Promise<Stripe.Price> {
    return this.stripe.prices.create({
      product: params.productId,
      unit_amount: params.unitAmount,
      currency: params.currency,
      recurring: {
        interval: params.recurringInterval,
        ...(params.recurringIntervalCount !== undefined && { interval_count: params.recurringIntervalCount }),
      },
    });
  }

  async archivePrice(priceId: string): Promise<Stripe.Price> {
    return this.stripe.prices.update(priceId, { active: false });
  }

  async createOneTimePrice(params: { productId: string; unitAmount: number; currency: string }): Promise<Stripe.Price> {
    return this.stripe.prices.create({
      product: params.productId,
      unit_amount: params.unitAmount,
      currency: params.currency,
    });
  }

  async createOneTimeCheckoutSession(params: {
    stripeCustomerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
    promotionCode?: string;
  }): Promise<Stripe.Checkout.Session> {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: params.stripeCustomerId,
      mode: 'payment',
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      payment_intent_data: {
        metadata: params.metadata,
      },
      metadata: params.metadata,
    };

    if (params.promotionCode) {
      const promotionCodes = await this.stripe.promotionCodes.list({
        code: params.promotionCode,
        active: true,
        limit: 1,
      });

      const promoCode = promotionCodes.data[0];

      if (promoCode) {
        sessionParams.discounts = [{ promotion_code: promoCode.id }];
      } else {
        sessionParams.allow_promotion_codes = true;
      }
    } else {
      sessionParams.allow_promotion_codes = true;
    }

    return this.stripe.checkout.sessions.create(sessionParams);
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean): Promise<Stripe.Subscription> {
    if (cancelAtPeriodEnd) {
      return this.stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    }

    return this.stripe.subscriptions.cancel(subscriptionId);
  }

  async createRefund(params: { paymentIntentId: string; amountCents?: number; reason?: string }): Promise<Stripe.Refund> {
    return this.stripe.refunds.create({
      payment_intent: params.paymentIntentId,
      ...(params.amountCents !== undefined && { amount: params.amountCents }),
      ...(params.reason !== undefined && { reason: params.reason as Stripe.RefundCreateParams.Reason }),
    });
  }
}
