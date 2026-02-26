import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { generateUuidV7 } from '@app/shared/utils/uuid.util';

export interface SubscriptionPlanRecord {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  amount_cents: number;
  currency: string;
  recurring_interval: string;
  recurring_interval_count: number;
  trial_days: number;
  is_active: boolean;
  is_archived: boolean;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  metadata: Record<string, unknown> | null;
  created_by_staff_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSubscriptionPlanData {
  name: string;
  slug?: string | undefined;
  description?: string | null | undefined;
  amount_cents: number;
  currency?: string | undefined;
  recurring_interval: string;
  recurring_interval_count?: number | undefined;
  trial_days?: number | undefined;
  is_active?: boolean | undefined;
  created_by_staff_id?: string | undefined;
}

export interface UpdateSubscriptionPlanData {
  name?: string | undefined;
  slug?: string | null | undefined;
  description?: string | null | undefined;
  amount_cents?: number | undefined;
  currency?: string | undefined;
  recurring_interval?: string | undefined;
  recurring_interval_count?: number | undefined;
  trial_days?: number | undefined;
  is_active?: boolean | undefined;
}

export interface FindAllFilters {
  include_archived?: boolean | undefined;
}

@Injectable()
export class SubscriptionPlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActive(): Promise<SubscriptionPlanRecord[]> {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: {
        isActive: true,
        isArchived: false,
        stripePriceId: { not: null },
      },
      orderBy: { amountCents: 'asc' },
    });

    return plans.map((p) => this.mapToRecord(p));
  }

  async findByStripePriceId(stripePriceId: string): Promise<SubscriptionPlanRecord | null> {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { stripePriceId },
    });

    if (!plan) {
      return null;
    }

    return this.mapToRecord(plan);
  }

  async findById(id: string): Promise<SubscriptionPlanRecord | null> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });

    if (!plan) {
      return null;
    }

    return this.mapToRecord(plan);
  }

  async findAll(filters: FindAllFilters = {}): Promise<SubscriptionPlanRecord[]> {
    const where: Record<string, unknown> = {};

    if (!filters.include_archived) {
      where.isArchived = false;
    }

    const plans = await this.prisma.subscriptionPlan.findMany({
      where,
      orderBy: { amountCents: 'asc' },
    });

    return plans.map((p) => this.mapToRecord(p));
  }

  async create(data: CreateSubscriptionPlanData): Promise<SubscriptionPlanRecord> {
    const id = generateUuidV7();

    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        id,
        name: data.name,
        slug: data.slug ?? null,
        description: data.description ?? null,
        amountCents: BigInt(data.amount_cents),
        currency: data.currency ?? 'usd',
        recurringInterval: data.recurring_interval,
        recurringIntervalCount: data.recurring_interval_count ?? 1,
        trialDays: data.trial_days ?? 0,
        isActive: data.is_active ?? true,
        createdByStaffId: data.created_by_staff_id ?? null,
      },
    });

    return this.mapToRecord(plan);
  }

  async update(id: string, data: UpdateSubscriptionPlanData): Promise<SubscriptionPlanRecord> {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.slug !== undefined) {
      updateData.slug = data.slug;
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    if (data.amount_cents !== undefined) {
      updateData.amountCents = BigInt(data.amount_cents);
    }

    if (data.currency !== undefined) {
      updateData.currency = data.currency;
    }

    if (data.recurring_interval !== undefined) {
      updateData.recurringInterval = data.recurring_interval;
    }

    if (data.recurring_interval_count !== undefined) {
      updateData.recurringIntervalCount = data.recurring_interval_count;
    }

    if (data.trial_days !== undefined) {
      updateData.trialDays = data.trial_days;
    }

    if (data.is_active !== undefined) {
      updateData.isActive = data.is_active;
    }

    updateData.updatedAt = new Date();

    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: updateData,
    });

    return this.mapToRecord(plan);
  }

  async archive(id: string): Promise<SubscriptionPlanRecord> {
    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: { isArchived: true, updatedAt: new Date() },
    });

    return this.mapToRecord(plan);
  }

  async unarchive(id: string): Promise<SubscriptionPlanRecord> {
    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: { isArchived: false, updatedAt: new Date() },
    });

    return this.mapToRecord(plan);
  }

  async updateStripeIds(id: string, data: { stripeProductId?: string; stripePriceId?: string }): Promise<SubscriptionPlanRecord> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.stripeProductId !== undefined) {
      updateData.stripeProductId = data.stripeProductId;
    }

    if (data.stripePriceId !== undefined) {
      updateData.stripePriceId = data.stripePriceId;
    }

    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: updateData,
    });

    return this.mapToRecord(plan);
  }

  private mapToRecord(plan: {
    id: string;
    name: string;
    slug: string | null;
    description: string | null;
    amountCents: bigint;
    currency: string;
    recurringInterval: string;
    recurringIntervalCount: number;
    trialDays: number;
    isActive: boolean;
    isArchived: boolean;
    stripeProductId: string | null;
    stripePriceId: string | null;
    metadata: unknown;
    createdByStaffId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): SubscriptionPlanRecord {
    return {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      amount_cents: Number(plan.amountCents),
      currency: plan.currency,
      recurring_interval: plan.recurringInterval,
      recurring_interval_count: plan.recurringIntervalCount,
      trial_days: plan.trialDays,
      is_active: plan.isActive,
      is_archived: plan.isArchived,
      stripe_product_id: plan.stripeProductId,
      stripe_price_id: plan.stripePriceId,
      metadata: plan.metadata as Record<string, unknown> | null,
      created_by_staff_id: plan.createdByStaffId,
      created_at: plan.createdAt,
      updated_at: plan.updatedAt,
    };
  }
}
