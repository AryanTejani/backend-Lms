import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { RefundService, SubscriptionRepository, SubscriptionPlanRepository } from '@app/billing';
import { CustomerAuthService } from '@app/auth';
import { StorageService } from '@app/shared';

export interface ProfileRecord {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  has_stripe_customer: boolean;
  active_subscriptions: number;
  total_orders: number;
  created_at: Date;
}

export interface SubscriptionDetailRecord {
  has_active_subscription: boolean;
  subscription: {
    status: string;
    plan_name: string | null;
    plan_description: string | null;
    unit_amount_cents: number;
    currency: string;
    recurring_interval: string;
    recurring_interval_count: number;
    current_period_end: Date;
    cancel_at_period_end: boolean;
  } | null;
}

export interface OrderRecord {
  id: string;
  order_number: string;
  status: string;
  order_type: string;
  currency: string;
  total_cents: number;
  refund_amount_cents: number | null;
  is_refundable: boolean;
  paid_at: Date | null;
  created_at: Date;
  created_year: number;
}

export interface OrdersResult {
  data: OrderRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface PurchaseRecord {
  id: string;
  product_name: string;
  product_slug: string | null;
  content_type: string;
  is_lifetime: boolean;
  thumbnail_url: string | null;
  status: string;
  granted_at: Date;
  created_at: Date;
}

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refundService: RefundService,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly subscriptionPlanRepository: SubscriptionPlanRepository,
    private readonly customerAuthService: CustomerAuthService,
    private readonly storageService: StorageService,
  ) {}

  async getProfile(customerId: string): Promise<ProfileRecord> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        stripeCustomerId: true,
        activeSubscriptions: true,
        totalOrders: true,
        createdAt: true,
      },
    });

    if (!customer) {
      throw Errors.accountNotFound();
    }

    return {
      id: customer.id,
      email: customer.email,
      first_name: customer.firstName,
      last_name: customer.lastName,
      avatar_url: customer.avatarUrl ?? null,
      has_stripe_customer: customer.stripeCustomerId !== null,
      active_subscriptions: customer.activeSubscriptions,
      total_orders: customer.totalOrders,
      created_at: customer.createdAt,
    };
  }

  async updateProfile(customerId: string, data: { first_name?: string; last_name?: string }): Promise<void> {
    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(data.first_name !== undefined && { firstName: data.first_name }),
        ...(data.last_name !== undefined && { lastName: data.last_name }),
      },
    });
  }

  async getSubscription(customerId: string): Promise<SubscriptionDetailRecord> {
    const subscription = await this.subscriptionRepository.findActiveByCustomerId(customerId);

    if (!subscription) {
      return { has_active_subscription: false, subscription: null };
    }

    let planName: string | null = null;
    let planDescription: string | null = null;

    if (subscription.plan_id) {
      const plan = await this.subscriptionPlanRepository.findById(subscription.plan_id);

      if (plan) {
        planName = plan.name;
        planDescription = plan.description;
      }
    }

    return {
      has_active_subscription: true,
      subscription: {
        status: subscription.status,
        plan_name: planName,
        plan_description: planDescription,
        unit_amount_cents: subscription.unit_amount_cents,
        currency: subscription.currency,
        recurring_interval: subscription.recurring_interval,
        recurring_interval_count: subscription.recurring_interval_count,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
    };
  }

  async getOrders(customerId: string, page: number, limit: number): Promise<OrdersResult> {
    const offset = (page - 1) * limit;

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        order_number: string;
        status: string;
        order_type: string;
        currency: string;
        total_cents: number;
        refund_amount_cents: number | null;
        paid_at: Date | null;
        created_at: Date;
        created_year: number;
      }>
    >`
      SELECT id, order_number, status, order_type, currency,
             total_cents, refund_amount_cents, paid_at, created_at, created_year
      FROM orders
      WHERE customer_id = ${customerId}::uuid
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countRows = await this.prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM orders WHERE customer_id = ${customerId}::uuid
    `;

    const total = countRows[0]?.count ?? 0;

    const data: OrderRecord[] = rows.map((row) => ({
      id: row.id,
      order_number: row.order_number,
      status: row.status,
      order_type: row.order_type,
      currency: row.currency,
      total_cents: Number(row.total_cents),
      refund_amount_cents: row.refund_amount_cents !== null ? Number(row.refund_amount_cents) : null,
      is_refundable: row.status === 'paid',
      paid_at: row.paid_at,
      created_at: row.created_at,
      created_year: Number(row.created_year),
    }));

    return { data, total, page, limit };
  }

  async getPurchases(customerId: string): Promise<PurchaseRecord[]> {
    const purchases = await this.prisma.purchase.findMany({
      where: { customerId, status: 'ACTIVE', subscriptionId: null },
      include: {
        product: {
          select: {
            productName: true,
            productSlug: true,
            contentType: true,
            thumbnailUrl: true,
            isPublished: true,
          },
        },
      },
      orderBy: { grantedAt: 'desc' },
    });

    // Prisma enum values are uppercase names; map to snake_case for API response
    const contentTypeMap: Record<string, string> = {
      COURSE: 'course',
      MASTER_CLASS: 'master_class',
      BUNDLE: 'bundle',
      DIGITAL_DOWNLOAD: 'digital_download',
    };

    const learningTypes = new Set(['COURSE', 'MASTER_CLASS', 'BUNDLE']);

    return purchases
      .filter((p) => learningTypes.has(p.product.contentType))
      .map((p) => ({
        id: p.id,
        product_name: p.product.productName,
        product_slug: p.product.productSlug,
        content_type: contentTypeMap[p.product.contentType] ?? p.product.contentType,
        is_lifetime: p.isLifetime,
        thumbnail_url: p.product.thumbnailUrl,
        status: p.status,
        granted_at: p.grantedAt,
        created_at: p.createdAt,
      }));
  }

  async requestRefund(customerId: string, orderId: string, reason?: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; created_year: number; status: string }>>`
      SELECT id, created_year, status
      FROM orders
      WHERE id = ${orderId}::uuid AND customer_id = ${customerId}::uuid
      LIMIT 1
    `;

    const order = rows[0];

    if (!order) {
      throw Errors.orderNotFound();
    }

    if (order.status !== 'paid') {
      throw Errors.orderNotRefundable();
    }

    await this.refundService.issueFullRefund(orderId, Number(order.created_year), reason);
  }

  async changePassword(customerId: string, currentPassword: string, newPassword: string): Promise<void> {
    await this.customerAuthService.changePassword(customerId, currentPassword, newPassword);
  }

  async uploadAvatar(customerId: string, buffer: Buffer, contentType: string, fileName: string): Promise<{ avatar_url: string }> {
    const result = await this.storageService.upload(
      {
        folder: 'customer-avatars',
        fileName,
        contentType,
        buffer,
      },
      'public',
    );

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { avatarUrl: result.cdnUrl },
    });

    return { avatar_url: result.cdnUrl };
  }

  async removeAvatar(customerId: string): Promise<void> {
    await this.prisma.customer.update({
      where: { id: customerId },
      data: { avatarUrl: null },
    });
  }
}
