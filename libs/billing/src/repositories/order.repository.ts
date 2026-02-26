import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { generateUuidV7 } from '@app/shared/utils/uuid.util';
import { randomBytes } from 'crypto';

export interface OrderRecord {
  id: string;
  order_number: string;
  status: string;
  order_type: string;
  customer_id: string;
  currency: string;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  created_year: number;
  paid_at: Date | null;
  created_at: Date;
}

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<OrderRecord | null> {
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT id, order_number, status, order_type, customer_id, currency,
             subtotal_cents::int8 as subtotal_cents, discount_cents::int8 as discount_cents,
             tax_cents::int8 as tax_cents, total_cents::int8 as total_cents,
             stripe_payment_intent_id, stripe_invoice_id, created_year,
             paid_at, created_at
      FROM orders
      WHERE stripe_payment_intent_id = ${stripePaymentIntentId}
      LIMIT 1
    `;

    const row = rows[0];

    if (!row) {
      return null;
    }

    return this.mapRawToRecord(row);
  }

  async findByStripeInvoiceId(stripeInvoiceId: string): Promise<OrderRecord | null> {
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT id, order_number, status, order_type, customer_id, currency,
             subtotal_cents::int8 as subtotal_cents, discount_cents::int8 as discount_cents,
             tax_cents::int8 as tax_cents, total_cents::int8 as total_cents,
             stripe_payment_intent_id, stripe_invoice_id, created_year,
             paid_at, created_at
      FROM orders
      WHERE stripe_invoice_id = ${stripeInvoiceId}
      LIMIT 1
    `;

    const row = rows[0];

    if (!row) {
      return null;
    }

    return this.mapRawToRecord(row);
  }

  async create(data: {
    customerId: string;
    orderType: 'CHECKOUT' | 'SUBSCRIPTION';
    currency: string;
    subtotalCents: bigint;
    discountCents: bigint;
    taxCents: bigint;
    totalCents: bigint;
    amountDueCents: bigint;
    stripePaymentIntentId?: string;
    stripeInvoiceId?: string;
    paidAt?: Date;
    status?: string;
  }): Promise<OrderRecord> {
    const id = generateUuidV7();
    const orderNumber = this.generateOrderNumber();
    const createdYear = new Date().getFullYear();
    const status = (data.status ?? 'PENDING').toLowerCase();
    const orderType = data.orderType.toLowerCase();
    const now = new Date();

    await this.prisma.$executeRaw`
      INSERT INTO orders (
        id, order_number, status, order_type, customer_id, currency,
        subtotal_cents, discount_cents, tax_cents, total_cents, amount_due_cents,
        stripe_payment_intent_id, stripe_invoice_id,
        paid_at, created_at, updated_at, created_year
      ) VALUES (
        ${id}::uuid, ${orderNumber}, ${status}::order_status, ${orderType}::order_type,
        ${data.customerId}::uuid, ${data.currency},
        ${data.subtotalCents}, ${data.discountCents}, ${data.taxCents},
        ${data.totalCents}, ${data.amountDueCents},
        ${data.stripePaymentIntentId ?? null}, ${data.stripeInvoiceId ?? null},
        ${data.paidAt ?? null}, ${now}, ${now}, ${createdYear}
      )
    `;

    return {
      id,
      order_number: orderNumber,
      status,
      order_type: data.orderType,
      customer_id: data.customerId,
      currency: data.currency,
      subtotal_cents: Number(data.subtotalCents),
      discount_cents: Number(data.discountCents),
      tax_cents: Number(data.taxCents),
      total_cents: Number(data.totalCents),
      stripe_payment_intent_id: data.stripePaymentIntentId ?? null,
      stripe_invoice_id: data.stripeInvoiceId ?? null,
      created_year: createdYear,
      paid_at: data.paidAt ?? null,
      created_at: now,
    };
  }

  async createOrderItem(data: {
    orderId: string;
    orderYear: number;
    productId: string;
    quantity: number;
    unitAmountCents: bigint;
    discountCents: bigint;
    taxCents: bigint;
    totalCents: bigint;
    currency: string;
    subscriptionId?: string;
  }): Promise<void> {
    const id = generateUuidV7();
    const now = new Date();
    const subscriptionId = data.subscriptionId ?? null;

    await this.prisma.$executeRaw`
      INSERT INTO order_items (
        id, order_id, order_year, product_id, quantity,
        unit_amount_cents, discount_cents, tax_cents, total_cents,
        currency, subscription_id, created_at, updated_at
      ) VALUES (
        ${id}::uuid, ${data.orderId}::uuid, ${data.orderYear},
        ${data.productId}::uuid, ${data.quantity},
        ${data.unitAmountCents}, ${data.discountCents}, ${data.taxCents},
        ${data.totalCents}, ${data.currency},
        ${subscriptionId}::uuid,
        ${now}, ${now}
      )
    `;
  }

  async updateStatus(id: string, createdYear: number, status: string): Promise<void> {
    const lowerStatus = status.toLowerCase();

    await this.prisma.$executeRaw`
      UPDATE orders SET status = ${lowerStatus}::order_status, updated_at = now()
      WHERE id = ${id}::uuid AND created_year = ${createdYear}
    `;
  }

  async updateRefund(
    id: string,
    createdYear: number,
    data: { status: string; refundAmountCents: number; refundReason?: string },
  ): Promise<void> {
    const lowerStatus = data.status.toLowerCase();
    const reason = data.refundReason ?? null;

    await this.prisma.$executeRaw`
      UPDATE orders
      SET status = ${lowerStatus}::order_status,
          refund_amount_cents = ${BigInt(data.refundAmountCents)},
          refund_reason = ${reason},
          refunded_at = now(),
          updated_at = now()
      WHERE id = ${id}::uuid AND created_year = ${createdYear}
    `;
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = randomBytes(3).toString('hex').toUpperCase();

    return `TL-${timestamp}-${random}`;
  }

  private mapRawToRecord(row: Record<string, unknown>): OrderRecord {
    return {
      id: String(row.id),
      order_number: String(row.order_number),
      status: String(row.status),
      order_type: String(row.order_type),
      customer_id: String(row.customer_id),
      currency: String(row.currency),
      subtotal_cents: Number(row.subtotal_cents),
      discount_cents: Number(row.discount_cents),
      tax_cents: Number(row.tax_cents),
      total_cents: Number(row.total_cents),
      stripe_payment_intent_id: row.stripe_payment_intent_id ? String(row.stripe_payment_intent_id) : null,
      stripe_invoice_id: row.stripe_invoice_id ? String(row.stripe_invoice_id) : null,
      created_year: Number(row.created_year),
      paid_at: row.paid_at ? new Date(String(row.paid_at)) : null,
      created_at: new Date(String(row.created_at)),
    };
  }
}
