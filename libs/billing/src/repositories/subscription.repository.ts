import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { generateUuidV7 } from '@app/shared/utils/uuid.util';
import type { SubscriptionStatus } from '@prisma/client';

export interface SubscriptionRecord {
  id: string;
  customer_id: string;
  plan_id: string | null;
  status: string;
  currency: string;
  unit_amount_cents: number;
  recurring_interval: string;
  recurring_interval_count: number;
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  canceled_at: Date | null;
  ended_at: Date | null;
  stripe_subscription_id: string | null;
  created_at: Date;
}

@Injectable()
export class SubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SubscriptionRecord | null> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      return null;
    }

    return this.mapToRecord(subscription);
  }

  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<SubscriptionRecord | null> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId },
    });

    if (!subscription) {
      return null;
    }

    return this.mapToRecord(subscription);
  }

  async findActiveByCustomerId(customerId: string): Promise<SubscriptionRecord | null> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        customerId,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return null;
    }

    return this.mapToRecord(subscription);
  }

  async create(data: {
    customerId: string;
    planId: string | null;
    status: SubscriptionStatus;
    currency: string;
    unitAmountCents: bigint;
    recurringInterval: string;
    recurringIntervalCount: number;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    stripeSubscriptionId: string;
    trialStart?: Date | undefined;
    trialEnd?: Date | undefined;
    cancelAtPeriodEnd?: boolean | undefined;
  }): Promise<SubscriptionRecord> {
    const subscription = await this.prisma.subscription.create({
      data: {
        id: generateUuidV7(),
        customerId: data.customerId,
        planId: data.planId,
        status: data.status,
        currency: data.currency,
        unitAmountCents: data.unitAmountCents,
        recurringInterval: data.recurringInterval,
        recurringIntervalCount: data.recurringIntervalCount,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        stripeSubscriptionId: data.stripeSubscriptionId,
        trialStart: data.trialStart ?? null,
        trialEnd: data.trialEnd ?? null,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
      },
    });

    return this.mapToRecord(subscription);
  }

  async updateByStripeSubscriptionId(
    stripeSubscriptionId: string,
    data: {
      status?: SubscriptionStatus;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
      cancelAtPeriodEnd?: boolean;
      canceledAt?: Date | null;
      endedAt?: Date | null;
    },
  ): Promise<void> {
    const existing = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId },
    });

    if (!existing) {
      return;
    }

    await this.prisma.subscription.update({
      where: { id: existing.id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.currentPeriodStart !== undefined && { currentPeriodStart: data.currentPeriodStart }),
        ...(data.currentPeriodEnd !== undefined && { currentPeriodEnd: data.currentPeriodEnd }),
        ...(data.cancelAtPeriodEnd !== undefined && { cancelAtPeriodEnd: data.cancelAtPeriodEnd }),
        ...(data.canceledAt !== undefined && { canceledAt: data.canceledAt }),
        ...(data.endedAt !== undefined && { endedAt: data.endedAt }),
        updatedAt: new Date(),
      },
    });
  }

  private mapToRecord(subscription: {
    id: string;
    customerId: string;
    planId: string | null;
    status: SubscriptionStatus;
    currency: string;
    unitAmountCents: bigint;
    recurringInterval: string;
    recurringIntervalCount: number;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
    endedAt: Date | null;
    stripeSubscriptionId: string | null;
    createdAt: Date;
  }): SubscriptionRecord {
    return {
      id: subscription.id,
      customer_id: subscription.customerId,
      plan_id: subscription.planId,
      status: subscription.status,
      currency: subscription.currency,
      unit_amount_cents: Number(subscription.unitAmountCents),
      recurring_interval: subscription.recurringInterval,
      recurring_interval_count: subscription.recurringIntervalCount,
      current_period_start: subscription.currentPeriodStart,
      current_period_end: subscription.currentPeriodEnd,
      cancel_at_period_end: subscription.cancelAtPeriodEnd,
      canceled_at: subscription.canceledAt,
      ended_at: subscription.endedAt,
      stripe_subscription_id: subscription.stripeSubscriptionId,
      created_at: subscription.createdAt,
    };
  }
}
