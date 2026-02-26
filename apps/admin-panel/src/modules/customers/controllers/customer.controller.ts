import { Controller, Get, Patch, Post, Param, Query, Body } from '@nestjs/common';
import { CustomerManagementService } from '@app/customer/services/customer-management.service';
import { RefundService } from '@app/billing/services/refund.service';
import { SubscriptionManagementService } from '@app/billing/services/subscription-management.service';
import { ZodValidationPipe } from '@app/shared/pipes/zod-validation.pipe';
import { Roles } from '../../../guards/role.guard';
import { updateCustomerEmailSchema, UpdateCustomerEmailInput } from '../schemas/customer.schema';
import { refundOrderSchema, RefundOrderInput } from '../schemas/customer.schema';
import { cancelSubscriptionSchema, CancelSubscriptionInput } from '../schemas/customer.schema';

@Controller('customers')
@Roles('admin')
export class CustomerController {
  constructor(
    private readonly customerManagementService: CustomerManagementService,
    private readonly refundService: RefundService,
    private readonly subscriptionManagementService: SubscriptionManagementService,
  ) {}

  @Get()
  async search(
    @Query('q') query?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{ data: unknown[]; total: number; page: number; limit: number }> {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));

    return this.customerManagementService.searchCustomers(query ?? '', pageNum, limitNum);
  }

  @Get(':id')
  async getDetails(@Param('id') id: string): Promise<unknown> {
    return this.customerManagementService.getCustomerDetails(id);
  }

  @Patch(':id/email')
  async updateEmail(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCustomerEmailSchema)) body: UpdateCustomerEmailInput,
  ): Promise<{ success: boolean }> {
    await this.customerManagementService.updateCustomerEmail(id, body.email);

    return { success: true };
  }

  @Post(':id/reset-password')
  async resetPassword(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.customerManagementService.adminResetPassword(id);
  }

  @Get(':id/subscriptions')
  async getSubscriptions(@Param('id') id: string): Promise<unknown[]> {
    return this.customerManagementService.getCustomerSubscriptions(id);
  }

  @Get(':id/orders')
  async getOrders(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{ data: unknown[]; total: number; page: number; limit: number }> {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));

    return this.customerManagementService.getCustomerOrders(id, pageNum, limitNum);
  }

  @Get(':id/purchases')
  async getPurchases(@Param('id') id: string): Promise<unknown[]> {
    return this.customerManagementService.getCustomerPurchases(id);
  }

  @Post(':id/orders/:orderId/refund')
  async refundOrder(
    @Param('id') _customerId: string,
    @Param('orderId') orderId: string,
    @Body(new ZodValidationPipe(refundOrderSchema)) body: RefundOrderInput,
  ): Promise<{ success: boolean }> {
    if (body.type === 'full') {
      await this.refundService.issueFullRefund(orderId, body.order_year, body.reason);
    } else {
      await this.refundService.issuePartialRefund(orderId, body.order_year, body.amount_cents, body.reason);
    }

    return { success: true };
  }

  @Post(':id/subscriptions/:subscriptionId/cancel')
  async cancelSubscription(
    @Param('id') _customerId: string,
    @Param('subscriptionId') subscriptionId: string,
    @Body(new ZodValidationPipe(cancelSubscriptionSchema)) body: CancelSubscriptionInput,
  ): Promise<{ success: boolean }> {
    await this.subscriptionManagementService.cancelSubscription(subscriptionId, body.cancel_at_period_end, body.reason);

    return { success: true };
  }
}
