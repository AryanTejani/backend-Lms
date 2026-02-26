import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { generateSecureToken, hashToken } from '@app/shared/utils/crypto.util';
import { CacheService } from '@app/shared/cache/cache.service';
import { EmailService } from '@app/shared/email/email.service';
import { CustomerRepository } from '@app/auth/repositories/customer.repository';
import { SessionRepository } from '@app/auth/repositories/session.repository';
import { SessionCacheService } from '@app/auth/services/session-cache.service';
import {
  CustomerManagementRepository,
  CustomerDetail,
  CustomerListItem,
  CustomerSubscriptionRecord,
  CustomerOrderRecord,
  CustomerPurchaseRecord,
} from '../repositories/customer-management.repository';

@Injectable()
export class CustomerManagementService {
  constructor(
    private readonly configService: ConfigService,
    private readonly customerManagementRepo: CustomerManagementRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly sessionCacheService: SessionCacheService,
    private readonly cacheService: CacheService,
    private readonly emailService: EmailService,
  ) {}

  async searchCustomers(
    query: string,
    page: number,
    limit: number,
  ): Promise<{ data: CustomerListItem[]; total: number; page: number; limit: number }> {
    const result = await this.customerManagementRepo.searchByEmailOrName(query, page, limit);

    return { ...result, page, limit };
  }

  async getCustomerDetails(id: string): Promise<CustomerDetail> {
    const customer = await this.customerManagementRepo.getById(id);

    if (!customer) {
      throw Errors.accountNotFound();
    }

    return customer;
  }

  async updateCustomerEmail(customerId: string, newEmail: string): Promise<void> {
    // Check if email is already taken
    const existing = await this.customerRepository.findByEmail(newEmail);

    if (existing && existing.id !== customerId) {
      throw Errors.emailAlreadyInUse();
    }

    await this.customerManagementRepo.updateEmail(customerId, newEmail);

    // Invalidate all sessions (force re-login with new email)
    const revokedCount = await this.sessionRepository.revokeAllForCustomer(customerId);

    if (revokedCount > 0) {
      await this.sessionCacheService.invalidateAllForCustomer(customerId);
    }
  }

  async adminResetPassword(customerId: string): Promise<{ success: boolean }> {
    const customer = await this.customerManagementRepo.getById(customerId);

    if (!customer) {
      throw Errors.accountNotFound();
    }

    // Generate a reset token and send via email instead of returning raw token
    const token = generateSecureToken();
    const tokenHash = hashToken(token);

    await this.cacheService.storePasswordResetToken(customer.email, tokenHash);

    const frontendUrl = this.configService.get<string>('frontend.url') || 'http://localhost:3001';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.emailService.sendPasswordResetEmail(customer.email, resetUrl);

    return { success: true };
  }

  async getCustomerSubscriptions(customerId: string): Promise<CustomerSubscriptionRecord[]> {
    return this.customerManagementRepo.getSubscriptions(customerId);
  }

  async getCustomerOrders(
    customerId: string,
    page: number,
    limit: number,
  ): Promise<{ data: CustomerOrderRecord[]; total: number; page: number; limit: number }> {
    const result = await this.customerManagementRepo.getOrders(customerId, page, limit);

    return { ...result, page, limit };
  }

  async getCustomerPurchases(customerId: string): Promise<CustomerPurchaseRecord[]> {
    return this.customerManagementRepo.getPurchases(customerId);
  }
}
