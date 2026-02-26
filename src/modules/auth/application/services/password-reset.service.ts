import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@/shared/cache/cache.service';
import { EmailService } from '@/shared/email/email.service';
import { CustomerRepository } from '../../infrastructure/persistence/customer.repository';
import { SessionRepository } from '../../infrastructure/persistence/session.repository';
import { SessionCacheService } from '../../domain/services/session-cache.service';
import {
  hashPassword,
  generateSecureToken,
  hashToken,
  verifyPassword,
} from '@/shared/utils/crypto.util';
import { Errors } from '@/shared/exceptions/auth.exception';

/**
 * Password Reset Service
 * Handles password reset flows for customers
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly emailService: EmailService,
    private readonly customerRepository: CustomerRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly sessionCacheService: SessionCacheService,
  ) {}

  /**
   * Request password reset - sends email with reset link
   * Throws ACCOUNT_NOT_FOUND if email is not registered
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; cooldownRemaining?: number }> {
    // Check cooldown first
    const cooldownRemaining = await this.cacheService.checkPasswordResetCooldown(email);

    if (cooldownRemaining !== null) {
      return { success: false, cooldownRemaining };
    }

    // Set cooldown immediately to prevent rapid requests
    await this.cacheService.setPasswordResetCooldown(email);

    // Check if customer exists
    const customer = await this.customerRepository.findByEmail(email);

    if (customer === null) {
      throw Errors.accountNotFound();
    }

    // Generate secure token
    const token = generateSecureToken(32);
    const tokenHash = hashToken(token);

    // Store hashed token in Redis
    await this.cacheService.storePasswordResetToken(email, tokenHash);

    // Build reset URL
    const frontendUrl = this.configService.get<string>('frontend.url') ?? '';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    // Send email with reset link
    try {
      await this.emailService.sendPasswordResetEmail(email, resetUrl);
    } catch (error) {
      // Log error but don't reveal to user
      const nodeEnv = this.configService.get<string>('server.nodeEnv');

      if (nodeEnv !== 'production') {
        console.error('Failed to send password reset email:', error);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('PASSWORD RESET LINK (DEV MODE - Email send failed)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`To: ${email}`);
        console.log(`Reset URL: ${resetUrl}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
    }

    return { success: true };
  }

  /**
   * Reset password using token from email link
   * Allows multiple attempts before invalidating the token
   */
  async resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
    // Hash the provided token
    const tokenHash = hashToken(token);

    // Get token data (don't delete yet - allow multiple attempts)
    const tokenData = await this.cacheService.getPasswordResetToken(tokenHash);

    if (tokenData === null) {
      throw Errors.tokenInvalidOrExpired();
    }

    // Check if max attempts exceeded
    const maxAttempts = this.configService.get<number>('passwordReset.maxAttempts') ?? 5;

    if (tokenData.attempts >= maxAttempts) {
      // Delete token since max attempts reached
      await this.cacheService.deletePasswordResetToken(tokenHash);
      throw Errors.passwordResetMaxAttempts();
    }

    // Get customer
    const customer = await this.customerRepository.findByEmail(tokenData.email);

    if (customer === null) {
      // Should not happen if token was valid, but handle gracefully
      throw Errors.accountNotFound();
    }

    // Check if new password is same as old password
    if (customer.password_hash !== null) {
      const isSamePassword = await verifyPassword(newPassword, customer.password_hash);

      if (isSamePassword) {
        // Increment attempts on validation failure
        await this.cacheService.incrementPasswordResetAttempts(tokenHash);
        throw Errors.passwordSameAsOld();
      }
    }

    // Hash new password
    const saltRounds = this.configService.get<number>('bcrypt.saltRounds') ?? 12;
    const passwordHash = await hashPassword(newPassword, saltRounds);

    // Update password in database
    await this.customerRepository.updatePassword(customer.id, passwordHash);

    // Clear forced password reset flag if set
    await this.customerRepository.clearPasswordResetRequired(customer.id);

    // Success - delete the token
    await this.cacheService.deletePasswordResetToken(tokenHash);

    // Revoke all sessions for security
    await this.sessionRepository.revokeAllForCustomer(customer.id);

    // Invalidate all cached sessions
    await this.sessionCacheService.invalidateAllForCustomer(customer.id);

    // Clear any remaining password reset data
    await this.cacheService.clearPasswordResetData(tokenData.email);
  }
}
