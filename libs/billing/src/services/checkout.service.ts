import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { StripeService } from './stripe.service';
import { CourseStripeSyncService } from './course-stripe-sync.service';
import { SubscriptionPlanRepository } from '../repositories/subscription-plan.repository';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import type { SubscriptionPlanRecord } from '../repositories/subscription-plan.repository';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly subscriptionPlanRepository: SubscriptionPlanRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly courseStripeSyncService: CourseStripeSyncService,
  ) { }

  async getActivePlans(): Promise<SubscriptionPlanRecord[]> {
    return this.subscriptionPlanRepository.findActive();
  }

  async createCheckoutSession(customerId: string, priceId: string, promotionCode?: string, isMobile: boolean = false): Promise<{ checkout_url: string }> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw Errors.customerNotFound();
    }

    // Lazy-create Stripe customer if needed
    let stripeCustomerId = customer.stripeCustomerId;

    if (!stripeCustomerId) {
      try {
        const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || undefined;
        const stripeCustomer = await this.stripeService.createCustomer(customer.email, fullName);

        stripeCustomerId = stripeCustomer.id;

        await this.prisma.customer.update({
          where: { id: customerId },
          data: { stripeCustomerId },
        });
      } catch (error) {
        this.logger.error('Failed to create Stripe customer', error);
        throw Errors.stripeCustomerCreationFailed();
      }
    }

    const frontendUrl = (this.configService.get<string>('frontend.url') ?? 'http://localhost:3000').trim();
    const baseCallbackUrl = isMobile ? 'arise://' : frontendUrl;
    const successUrl = isMobile
      ? `${baseCallbackUrl}payment/success?session_id={CHECKOUT_SESSION_ID}`
      : `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = isMobile ? `${baseCallbackUrl}payment/cancel` : `${frontendUrl}/payment`;

    try {
      const session = await this.stripeService.createCheckoutSession({
        stripeCustomerId,
        priceId,
        successUrl,
        cancelUrl,
        ...(promotionCode !== undefined && { promotionCode }),
      });

      if (!session.url) {
        throw Errors.stripeCheckoutFailed('No checkout URL returned');
      }

      return { checkout_url: session.url };
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }

      this.logger.error('Failed to create checkout session', error);
      throw Errors.stripeCheckoutFailed();
    }
  }

  async createPortalSession(customerId: string): Promise<{ portal_url: string }> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw Errors.customerNotFound();
    }

    if (!customer.stripeCustomerId) {
      throw Errors.stripePortalFailed();
    }

    const frontendUrl = (this.configService.get<string>('frontend.url') ?? 'http://localhost:3000').trim();
    const returnUrl = `${frontendUrl}/account`;

    try {
      const session = await this.stripeService.createPortalSession(customer.stripeCustomerId, returnUrl);

      return { portal_url: session.url };
    } catch (error) {
      this.logger.error('Failed to create portal session', error);
      throw Errors.stripePortalFailed();
    }
  }

  async createCourseCheckoutSession(
    customerId: string,
    productId: string,
    promotionCode?: string,
    isMobile: boolean = false,
  ): Promise<{ checkout_url: string }> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });

    if (!product || product.deletedAt !== null) {
      throw Errors.productNotFound();
    }

    let stripePriceId = product.stripePriceId;

    if (!stripePriceId) {
      // Lazy sync for courses published before Stripe sync was deployed
      await this.courseStripeSyncService.syncProductToStripe(productId);
      const refreshed = await this.prisma.product.findUnique({ where: { id: productId } });

      stripePriceId = refreshed?.stripePriceId ?? null;

      if (!stripePriceId) {
        throw Errors.stripeCheckoutFailed('Failed to create Stripe price for product');
      }
    }

    if (Number(product.amountCents) === 0) {
      throw Errors.stripeCheckoutFailed('Cannot purchase a free product');
    }

    // Check if customer already has access
    const accessResult = await this.prisma.$queryRawUnsafe<Array<{ has_access: boolean }>>(
      'SELECT has_access($1::uuid, $2::uuid) as has_access',
      customerId,
      productId,
    );

    if (accessResult[0]?.has_access === true) {
      throw Errors.alreadyPurchased();
    }

    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });

    if (!customer) {
      throw Errors.customerNotFound();
    }

    // Lazy-create Stripe customer if needed
    let stripeCustomerId = customer.stripeCustomerId;

    if (!stripeCustomerId) {
      try {
        const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || undefined;
        const stripeCustomer = await this.stripeService.createCustomer(customer.email, fullName);

        stripeCustomerId = stripeCustomer.id;

        await this.prisma.customer.update({
          where: { id: customerId },
          data: { stripeCustomerId },
        });
      } catch (error) {
        this.logger.error('Failed to create Stripe customer', error);
        throw Errors.stripeCustomerCreationFailed();
      }
    }

    const frontendUrl = (this.configService.get<string>('frontend.url') ?? 'http://localhost:3000').trim();
    const slug = encodeURIComponent(product.productSlug ?? product.id);
    const baseCallbackUrl = isMobile ? 'arise://' : frontendUrl;

    const successUrl = isMobile
      ? `${baseCallbackUrl}academy/${slug}?purchased=true`
      : `${frontendUrl}/academy/${slug}?purchased=true`;
    const cancelUrl = isMobile ? `${baseCallbackUrl}academy/${slug}` : `${frontendUrl}/academy/${slug}`;

    try {
      const session = await this.stripeService.createOneTimeCheckoutSession({
        stripeCustomerId,
        priceId: stripePriceId,
        successUrl,
        cancelUrl,
        metadata: {
          traderlion_customer_id: customerId,
          traderlion_product_id: productId,
        },
        ...(promotionCode !== undefined && { promotionCode }),
      });

      if (!session.url) {
        throw Errors.stripeCheckoutFailed('No checkout URL returned');
      }

      return { checkout_url: session.url };
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }

      this.logger.error('Failed to create course checkout session', error);
      throw Errors.stripeCheckoutFailed();
    }
  }

  async getSubscriptionStatus(customerId: string): Promise<{
    has_active_subscription: boolean;
    subscription: {
      status: string;
      plan_name: string | null;
      current_period_end: Date;
    } | null;
  }> {
    const subscription = await this.subscriptionRepository.findActiveByCustomerId(customerId);

    if (!subscription) {
      return { has_active_subscription: false, subscription: null };
    }

    let planName: string | null = null;

    if (subscription.plan_id) {
      const plan = await this.subscriptionPlanRepository.findById(subscription.plan_id);

      planName = plan?.name ?? null;
    }

    return {
      has_active_subscription: true,
      subscription: {
        status: subscription.status,
        plan_name: planName,
        current_period_end: subscription.current_period_end,
      },
    };
  }
}
