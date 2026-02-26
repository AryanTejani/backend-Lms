import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { StripeService } from './stripe.service';
import { OrderRepository } from '../repositories/order.repository';

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly orderRepository: OrderRepository,
  ) {}

  async issuePartialRefund(orderId: string, orderYear: number, amountCents: number, reason?: string): Promise<void> {
    const order = await this.orderRepository.findByStripePaymentIntentId(
      await this.getPaymentIntentId(orderId, orderYear),
    );

    if (!order) {
      throw Errors.orderNotFound();
    }

    if (order.status !== 'PAID') {
      throw Errors.orderNotRefundable();
    }

    if (!order.stripe_payment_intent_id) {
      throw Errors.orderNotRefundable();
    }

    if (amountCents >= order.total_cents) {
      throw Errors.refundFailed('Partial refund amount must be less than order total. Use full refund instead.');
    }

    try {
      await this.stripeService.createRefund({
        paymentIntentId: order.stripe_payment_intent_id,
        amountCents,
        ...(reason !== undefined && { reason }),
      });
    } catch (error) {
      this.logger.error(`Stripe refund failed for order ${orderId}`, error);
      throw Errors.refundFailed('Stripe refund request failed');
    }

    await this.orderRepository.updateRefund(order.id, order.created_year, {
      status: 'PARTIALLY_REFUNDED',
      refundAmountCents: amountCents,
      ...(reason !== undefined && { refundReason: reason }),
    });

    this.logger.log(`Partial refund of ${amountCents} cents issued for order ${order.order_number}`);
  }

  async issueFullRefund(orderId: string, orderYear: number, reason?: string): Promise<void> {
    const paymentIntentId = await this.getPaymentIntentId(orderId, orderYear);

    const order = await this.orderRepository.findByStripePaymentIntentId(paymentIntentId);

    if (!order) {
      throw Errors.orderNotFound();
    }

    if (order.status !== 'PAID' && order.status !== 'PARTIALLY_REFUNDED') {
      throw Errors.orderNotRefundable();
    }

    if (!order.stripe_payment_intent_id) {
      throw Errors.orderNotRefundable();
    }

    try {
      await this.stripeService.createRefund({
        paymentIntentId: order.stripe_payment_intent_id,
        ...(reason !== undefined && { reason }),
      });
    } catch (error) {
      this.logger.error(`Stripe full refund failed for order ${orderId}`, error);
      throw Errors.refundFailed('Stripe refund request failed');
    }

    await this.orderRepository.updateRefund(order.id, order.created_year, {
      status: 'REFUNDED',
      refundAmountCents: order.total_cents,
      ...(reason !== undefined && { refundReason: reason }),
    });

    // Revoke all purchases linked to this order
    await this.prisma.purchase.updateMany({
      where: {
        orderId: order.id,
        status: 'ACTIVE',
      },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokeReason: reason ?? 'Full refund issued',
      },
    });

    // Decrement customer total spent
    await this.prisma.customer.update({
      where: { id: order.customer_id },
      data: {
        totalSpentCents: { decrement: BigInt(order.total_cents) },
      },
    });

    this.logger.log(`Full refund issued for order ${order.order_number}`);
  }

  private async getPaymentIntentId(orderId: string, orderYear: number): Promise<string> {
    const rows = await this.prisma.$queryRaw<Array<{ stripe_payment_intent_id: string | null }>>`
      SELECT stripe_payment_intent_id
      FROM orders
      WHERE id = ${orderId}::uuid AND created_year = ${orderYear}
      LIMIT 1
    `;

    const row = rows[0];

    if (!row) {
      throw Errors.orderNotFound();
    }

    if (!row.stripe_payment_intent_id) {
      throw Errors.orderNotRefundable();
    }

    return row.stripe_payment_intent_id;
  }
}
