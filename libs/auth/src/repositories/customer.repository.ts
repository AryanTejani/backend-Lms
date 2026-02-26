import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { generateUuidV7 } from '@app/shared/utils/uuid.util';
import { Customer } from '../types/auth.types';

/**
 * Customer Repository
 * Uses Prisma for CRUD operations against the customers table
 */
@Injectable()
export class CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<Customer | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { email },
    });

    if (!customer) {
      return null;
    }

    return this.mapToCustomer(customer);
  }

  async findById(id: string): Promise<Customer | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return null;
    }

    return this.mapToCustomer(customer);
  }

  /**
   * Create a new customer account.
   * Callers must verify the email doesn't already exist before calling.
   */
  async create(params: { email: string; passwordHash: string | null }): Promise<Customer> {
    const id = generateUuidV7();
    const customer = await this.prisma.customer.create({
      data: {
        id,
        email: params.email,
        passwordHash: params.passwordHash,
      },
    });

    return this.mapToCustomer(customer);
  }

  /**
   * Create customer within a Prisma transaction (for OAuth flows)
   */
  async createWithTransaction(tx: Prisma.TransactionClient, params: { email: string; passwordHash: string | null }): Promise<Customer> {
    const id = generateUuidV7();
    const customer = await tx.customer.create({
      data: {
        id,
        email: params.email,
        passwordHash: params.passwordHash,
      },
    });

    return this.mapToCustomer(customer);
  }

  /**
   * Find customer by email within a Prisma transaction
   */
  async findByEmailWithTransaction(tx: Prisma.TransactionClient, email: string): Promise<Customer | null> {
    const customer = await tx.customer.findUnique({
      where: { email },
    });

    if (!customer) {
      return null;
    }

    return this.mapToCustomer(customer);
  }

  /**
   * Find customer by ID within a Prisma transaction
   */
  async findByIdWithTransaction(tx: Prisma.TransactionClient, id: string): Promise<Customer | null> {
    const customer = await tx.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return null;
    }

    return this.mapToCustomer(customer);
  }

  async updatePassword(customerId: string, passwordHash: string): Promise<void> {
    await this.prisma.customer.update({
      where: { id: customerId },
      data: { passwordHash },
    });
  }

  /**
   * Map Prisma Customer model to domain Customer type
   */
  async clearPasswordResetRequired(customerId: string): Promise<void> {
    await this.prisma.customer.update({
      where: { id: customerId },
      data: { requiresPasswordReset: false },
    });
  }

  async saveOnboarding(
    customerId: string,
    data: {
      languagePreference: string;
      age: number | null;
      grade: string | null;
      subjects: string[];
      learningGoals: string[];
    },
  ): Promise<void> {
    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        languagePreference: data.languagePreference,
        age: data.age,
        grade: data.grade,
        subjects: data.subjects,
        learningGoals: data.learningGoals,
        onboardingCompleted: true,
      },
    });
  }

  async updateLanguagePreference(customerId: string, languagePreference: string): Promise<void> {
    await this.prisma.customer.update({
      where: { id: customerId },
      data: { languagePreference },
    });
  }

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
