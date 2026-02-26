import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { generateUuidV7 } from '@app/shared/utils/uuid.util';
import { OAuthAccount, Customer } from '../types/auth.types';

/**
 * OAuth Account Repository
 * Uses Prisma for all operations with $transaction for atomic operations
 */
@Injectable()
export class OAuthAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProvider(provider: string, providerAccountId: string): Promise<OAuthAccount | null> {
    const account = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
    });

    if (!account) {
      return null;
    }

    return this.mapToOAuthAccount(account);
  }

  async create(
    params: {
      customerId: string;
      provider: string;
      providerAccountId: string;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<OAuthAccount> {
    const id = generateUuidV7();
    const client = tx ?? this.prisma;

    const account = await client.oAuthAccount.create({
      data: {
        id,
        customerId: params.customerId,
        provider: params.provider,
        providerAccountId: params.providerAccountId,
      },
    });

    return this.mapToOAuthAccount(account);
  }

  /**
   * Find or create customer by OAuth (atomic transaction)
   * Uses Prisma $transaction for cleaner transaction handling
   */
  async findOrCreateCustomerByOAuth(params: {
    provider: string;
    providerAccountId: string;
    email: string;
  }): Promise<{ customer: Customer; isNewCustomer: boolean; isNewLink: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      // Check if OAuth account exists
      const existingOAuth = await tx.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: params.provider,
            providerAccountId: params.providerAccountId,
          },
        },
        include: { customer: true },
      });

      if (existingOAuth) {
        // OAuth account exists, return linked customer
        return {
          customer: this.mapToCustomer(existingOAuth.customer),
          isNewCustomer: false,
          isNewLink: false,
        };
      }

      // Check if customer with email exists (for account linking)
      const existingCustomer = await tx.customer.findUnique({
        where: { email: params.email },
      });

      if (existingCustomer) {
        // Link OAuth to existing customer
        const oauthId = generateUuidV7();

        await tx.oAuthAccount.create({
          data: {
            id: oauthId,
            customerId: existingCustomer.id,
            provider: params.provider,
            providerAccountId: params.providerAccountId,
          },
        });

        return {
          customer: this.mapToCustomer(existingCustomer),
          isNewCustomer: false,
          isNewLink: true,
        };
      }

      // Create new customer and OAuth account
      const customerId = generateUuidV7();
      const oauthId = generateUuidV7();

      const newCustomer = await tx.customer.create({
        data: {
          id: customerId,
          email: params.email,
          passwordHash: null,
        },
      });

      await tx.oAuthAccount.create({
        data: {
          id: oauthId,
          customerId,
          provider: params.provider,
          providerAccountId: params.providerAccountId,
        },
      });

      return {
        customer: this.mapToCustomer(newCustomer),
        isNewCustomer: true,
        isNewLink: false,
      };
    });
  }

  /**
   * Map Prisma OAuthAccount model to domain OAuthAccount type
   */
  private mapToOAuthAccount(account: { id: string; customerId: string; provider: string; providerAccountId: string; createdAt: Date }): OAuthAccount {
    return {
      id: account.id,
      customer_id: account.customerId,
      provider: account.provider,
      provider_account_id: account.providerAccountId,
      created_at: account.createdAt,
    };
  }

  /**
   * Map Prisma Customer model to domain Customer type
   */
  private mapToCustomer(customer: {
    id: string;
    email: string;
    passwordHash: string | null;
    firstName: string | null;
    lastName: string | null;
    stripeCustomerId: string | null;
    requiresPasswordReset: boolean;
    languagePreference: string;
    onboardingCompleted: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Customer {
    return {
      id: customer.id,
      email: customer.email,
      password_hash: customer.passwordHash,
      first_name: customer.firstName,
      last_name: customer.lastName,
      stripe_customer_id: customer.stripeCustomerId,
      requires_password_reset: customer.requiresPasswordReset,
      language_preference: customer.languagePreference,
      onboarding_completed: customer.onboardingCompleted,
      created_at: customer.createdAt,
      updated_at: customer.updatedAt,
    };
  }
}
