import { Injectable, Logger } from '@nestjs/common';
import { Errors } from '@app/shared/exceptions/auth.exception';
import type Stripe from 'stripe';
import {
  SubscriptionPlanRepository,
  SubscriptionPlanRecord,
  CreateSubscriptionPlanData,
  UpdateSubscriptionPlanData,
  FindAllFilters,
} from '../repositories/subscription-plan.repository';
import { StripeService } from './stripe.service';

const PRICING_FIELDS = ['amount_cents', 'currency', 'recurring_interval', 'recurring_interval_count'] as const;

@Injectable()
export class SubscriptionPlanService {
  private readonly logger = new Logger(SubscriptionPlanService.name);

  constructor(
    private readonly planRepository: SubscriptionPlanRepository,
    private readonly stripeService: StripeService,
  ) {}

  async findAll(filters: FindAllFilters = {}): Promise<SubscriptionPlanRecord[]> {
    return this.planRepository.findAll(filters);
  }

  async findById(id: string): Promise<SubscriptionPlanRecord> {
    const plan = await this.planRepository.findById(id);

    if (!plan) {
      throw Errors.planNotFound();
    }

    return plan;
  }

  async create(data: CreateSubscriptionPlanData): Promise<SubscriptionPlanRecord> {
    const plan = await this.planRepository.create(data);

    try {
      const product = await this.stripeService.createProduct({
        name: data.name,
        ...(data.description != null && { description: data.description }),
        metadata: { traderlion_plan_id: plan.id },
      });

      const price = await this.stripeService.createPrice({
        productId: product.id,
        unitAmount: data.amount_cents,
        currency: data.currency ?? 'inr',
        recurringInterval: data.recurring_interval as Stripe.PriceCreateParams.Recurring.Interval,
        ...(data.recurring_interval_count !== undefined && { recurringIntervalCount: data.recurring_interval_count }),
      });

      return await this.planRepository.updateStripeIds(plan.id, {
        stripeProductId: product.id,
        stripePriceId: price.id,
      });
    } catch (error) {
      this.logger.error(`Failed to sync plan ${plan.id} to Stripe`, error);
      throw Errors.stripePlanSyncFailed('Failed to create Stripe product/price for plan');
    }
  }

  async update(id: string, data: UpdateSubscriptionPlanData): Promise<SubscriptionPlanRecord> {
    const existing = await this.findById(id);
    const updatedPlan = await this.planRepository.update(id, data);

    if (!existing.stripe_product_id) {
      this.logger.warn(`Plan ${id} has no Stripe product ID — skipping Stripe sync`);

      return updatedPlan;
    }

    try {
      const metadataChanged = data.name !== undefined || data.description !== undefined;

      if (metadataChanged) {
        await this.stripeService.updateProduct(existing.stripe_product_id, {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description ?? '' }),
        });
      }

      const pricingChanged = PRICING_FIELDS.some((field) => data[field] !== undefined);

      if (pricingChanged && existing.stripe_price_id) {
        const price = await this.stripeService.createPrice({
          productId: existing.stripe_product_id,
          unitAmount: data.amount_cents ?? existing.amount_cents,
          currency: data.currency ?? existing.currency,
          recurringInterval: (data.recurring_interval ?? existing.recurring_interval) as Stripe.PriceCreateParams.Recurring.Interval,
          recurringIntervalCount: data.recurring_interval_count ?? existing.recurring_interval_count,
        });

        await this.stripeService.archivePrice(existing.stripe_price_id);

        return await this.planRepository.updateStripeIds(id, { stripePriceId: price.id });
      }
    } catch (error) {
      this.logger.error(`Failed to sync plan ${id} update to Stripe`, error);
      throw Errors.stripePlanSyncFailed('Failed to update plan in Stripe');
    }

    return updatedPlan;
  }

  async syncToStripe(id: string): Promise<SubscriptionPlanRecord> {
    const plan = await this.findById(id);

    if (plan.stripe_product_id && plan.stripe_price_id) {
      return plan;
    }

    try {
      let productId = plan.stripe_product_id;

      if (!productId) {
        const product = await this.stripeService.createProduct({
          name: plan.name,
          ...(plan.description != null && { description: plan.description }),
          metadata: { traderlion_plan_id: plan.id },
        });

        productId = product.id;
      }

      const price = await this.stripeService.createPrice({
        productId,
        unitAmount: plan.amount_cents,
        currency: plan.currency,
        recurringInterval: plan.recurring_interval as Stripe.PriceCreateParams.Recurring.Interval,
        recurringIntervalCount: plan.recurring_interval_count,
      });

      return await this.planRepository.updateStripeIds(plan.id, {
        stripeProductId: productId,
        stripePriceId: price.id,
      });
    } catch (error) {
      this.logger.error(`Failed to sync existing plan ${id} to Stripe`, error);
      throw Errors.stripePlanSyncFailed('Failed to sync existing plan to Stripe');
    }
  }

  async archive(id: string): Promise<SubscriptionPlanRecord> {
    const plan = await this.findById(id);

    if (plan.stripe_price_id) {
      try {
        await this.stripeService.archivePrice(plan.stripe_price_id);
      } catch (error) {
        this.logger.error(`Failed to archive Stripe price ${plan.stripe_price_id}`, error);
      }
    }

    return this.planRepository.archive(id);
  }

  async unarchive(id: string): Promise<SubscriptionPlanRecord> {
    await this.findById(id);

    return this.planRepository.unarchive(id);
  }
}
