import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomerRepository } from '../repositories/customer.repository';
import { SessionRepository } from '../repositories/session.repository';
import { SessionCacheService } from './session-cache.service';
import { hashPassword, verifyPassword } from '@app/shared/utils/crypto.util';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { SignupParams, LoginParams, AuthenticatedUser, Session, Customer, SessionCustomer } from '../types/auth.types';

/**
 * Customer Auth Service
 * Handles email/password authentication against the customers table
 */
@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly customerRepository: CustomerRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly sessionCacheService: SessionCacheService,
  ) {}

  private toAuthenticatedUser(customer: Customer | SessionCustomer): AuthenticatedUser {
    return {
      id: customer.id,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
      language_preference: customer.language_preference,
      onboarding_completed: customer.onboarding_completed,
    };
  }

  async signup(params: SignupParams): Promise<{ user: AuthenticatedUser; session: Session }> {
    const { email, password } = params;

    const existingCustomer = await this.customerRepository.findByEmail(email);

    // If customer exists (with or without a password), block signup entirely.
    // Migrated users without passwords must use the password reset flow.
    if (existingCustomer) {
      throw Errors.emailAlreadyExists();
    }

    const saltRounds = this.configService.get<number>('bcrypt.saltRounds') ?? 12;
    const passwordHash = await hashPassword(password, saltRounds);

    const customer = await this.customerRepository.create({
      email,
      passwordHash,
    });

    const session = await this.sessionRepository.create(customer.id);

    return {
      user: this.toAuthenticatedUser(customer),
      session,
    };
  }

  async login(params: LoginParams): Promise<{ user: AuthenticatedUser; session: Session }> {
    const { email, password } = params;

    const customer = await this.customerRepository.findByEmail(email);

    if (!customer) {
      throw Errors.invalidCredentials();
    }

    if (customer.password_hash === null) {
      if (customer.requires_password_reset) {
        throw Errors.passwordResetRequired();
      }

      throw Errors.invalidCredentials();
    }

    const isValid = await verifyPassword(password, customer.password_hash);

    if (!isValid) {
      throw Errors.invalidCredentials();
    }

    if (customer.requires_password_reset) {
      throw Errors.passwordResetRequired();
    }

    const session = await this.sessionRepository.create(customer.id);

    return {
      user: this.toAuthenticatedUser(customer),
      session,
    };
  }

  async logout(sessionId: string): Promise<void> {
    // Invalidate cache first (fail fast)
    await this.sessionCacheService.invalidate(sessionId);
    await this.sessionRepository.revoke(sessionId);
  }

  async validateSession(sessionId: string): Promise<AuthenticatedUser | null> {
    // Check cache first
    const cached = await this.sessionCacheService.get(sessionId);

    if (cached !== null) {
      return cached.user;
    }

    // Cache miss - query database
    const sessionWithCustomer = await this.sessionRepository.findActiveWithCustomer(sessionId);

    if (!sessionWithCustomer) {
      return null;
    }

    const user = this.toAuthenticatedUser(sessionWithCustomer.customer);

    // Cache the session for future requests
    await this.sessionCacheService.set(sessionId, sessionWithCustomer.customer_id, user);

    return user;
  }

  async getCustomerById(id: string): Promise<AuthenticatedUser | null> {
    const customer = await this.customerRepository.findById(id);

    if (!customer) {
      return null;
    }

    return this.toAuthenticatedUser(customer);
  }

  async changePassword(customerId: string, currentPassword: string, newPassword: string): Promise<void> {
    const customer = await this.customerRepository.findById(customerId);

    if (!customer || !customer.password_hash) {
      throw Errors.accountNotFound();
    }

    const valid = await verifyPassword(currentPassword, customer.password_hash);

    if (!valid) {
      throw Errors.invalidCredentials();
    }

    if (currentPassword === newPassword) {
      throw Errors.passwordSameAsOld();
    }

    const saltRounds = this.configService.get<number>('bcrypt.saltRounds') ?? 12;
    const hashed = await hashPassword(newPassword, saltRounds);

    await this.customerRepository.updatePassword(customerId, hashed);
  }
}
