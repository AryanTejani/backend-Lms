import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';

export interface CustomerListItem {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  total_orders: number;
  total_spent_cents: number;
  active_subscriptions: number;
  created_at: Date;
}

export interface CustomerDetail {
  id: string;
  surecart_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  user_nicename: string | null;
  phone: string | null;
  stripe_customer_id: string | null;
  requires_password_reset: boolean;
  total_orders: number;
  total_spent_cents: number;
  active_subscriptions: number;
  is_live_mode: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CustomerSubscriptionRecord {
  id: string;
  plan_name: string | null;
  status: string;
  currency: string;
  unit_amount_cents: number;
  recurring_interval: string;
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  canceled_at: Date | null;
  stripe_subscription_id: string | null;
  created_at: Date;
}

export interface CustomerOrderRecord {
  id: string;
  order_number: string;
  status: string;
  order_type: string;
  currency: string;
  total_cents: number;
  created_at: Date;
  paid_at: Date | null;
  created_year: number;
}

export interface CustomerPurchaseRecord {
  id: string;
  product_name: string;
  product_slug: string | null;
  is_lifetime: boolean;
  status: string;
  granted_at: Date;
  expires_at: Date | null;
}

@Injectable()
export class CustomerManagementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async searchByEmailOrName(query: string, page: number, limit: number): Promise<{ data: CustomerListItem[]; total: number }> {
    const offset = (page - 1) * limit;
    const searchPattern = `%${query}%`;

    const [data, countResult] = await Promise.all([
      this.prisma.$queryRaw<CustomerListItem[]>`
        SELECT id, email, first_name, last_name, total_orders, total_spent_cents, active_subscriptions, created_at
        FROM customers
        WHERE deleted_at IS NULL
          AND (email ILIKE ${searchPattern}
            OR first_name ILIKE ${searchPattern}
            OR last_name ILIKE ${searchPattern})
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint as count
        FROM customers
        WHERE deleted_at IS NULL
          AND (email ILIKE ${searchPattern}
            OR first_name ILIKE ${searchPattern}
            OR last_name ILIKE ${searchPattern})
      `,
    ]);

    return {
      data: data.map((row) => ({ ...row, total_spent_cents: Number(row.total_spent_cents) })),
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  async getById(id: string): Promise<CustomerDetail | null> {
    const result = await this.prisma.$queryRaw<CustomerDetail[]>`
      SELECT id, surecart_id, email, first_name, last_name, user_nicename, phone,
             stripe_customer_id, requires_password_reset, total_orders, total_spent_cents,
             active_subscriptions, is_live_mode, created_at, updated_at
      FROM customers
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;

    const row = result[0] ?? null;

    return row ? { ...row, total_spent_cents: Number(row.total_spent_cents) } : null;
  }

  async updateEmail(id: string, newEmail: string): Promise<void> {
    await this.prisma.customer.update({
      where: { id },
      data: { email: newEmail },
    });
  }

  async getSubscriptions(customerId: string): Promise<CustomerSubscriptionRecord[]> {
    const rows = await this.prisma.$queryRaw<CustomerSubscriptionRecord[]>`
      SELECT s.id, sp.name as plan_name, s.status::text, s.currency, s.unit_amount_cents,
             s.recurring_interval, s.current_period_start, s.current_period_end,
             s.cancel_at_period_end, s.canceled_at, s.stripe_subscription_id, s.created_at
      FROM subscriptions s
      LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
      WHERE s.customer_id = ${customerId}::uuid
      ORDER BY s.created_at DESC
    `;

    return rows.map((row) => ({ ...row, unit_amount_cents: Number(row.unit_amount_cents) }));
  }

  async getOrders(customerId: string, page: number, limit: number): Promise<{ data: CustomerOrderRecord[]; total: number }> {
    const offset = (page - 1) * limit;

    const [data, countResult] = await Promise.all([
      this.prisma.$queryRaw<CustomerOrderRecord[]>`
        SELECT id, order_number, status::text, order_type::text, currency, total_cents,
               created_at, paid_at, created_year
        FROM orders
        WHERE customer_id = ${customerId}::uuid
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint as count
        FROM orders
        WHERE customer_id = ${customerId}::uuid
      `,
    ]);

    return {
      data: data.map((row) => ({ ...row, total_cents: Number(row.total_cents) })),
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  async getPurchases(customerId: string): Promise<CustomerPurchaseRecord[]> {
    return this.prisma.$queryRaw<CustomerPurchaseRecord[]>`
      SELECT p.id, pr.product_name, pr.product_slug, p.is_lifetime,
             p.status::text, p.granted_at, p.expires_at
      FROM purchases p
      JOIN products pr ON pr.id = p.product_id
      WHERE p.customer_id = ${customerId}::uuid
        AND p.status = 'active'
      ORDER BY p.granted_at DESC
    `;
  }
}
