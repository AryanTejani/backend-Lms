import { Injectable } from '@nestjs/common';
import { StaffRepository } from '../repositories/staff.repository';
import { StaffSessionRepository } from '../repositories/staff-session.repository';
import { AdminSessionCacheService } from './admin-session-cache.service';
import { verifyPassword } from '@app/shared/utils/crypto.util';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { AdminLoginParams, AuthenticatedAdmin, StaffSession, StaffUser, SessionStaffUser } from '../types/admin-auth.types';

/**
 * Admin Auth Service
 * Handles session-based authentication for staff (admins/instructors)
 */
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly staffRepository: StaffRepository,
    private readonly staffSessionRepository: StaffSessionRepository,
    private readonly adminSessionCacheService: AdminSessionCacheService,
  ) {}

  private toAuthenticatedAdmin(staff: StaffUser | SessionStaffUser): AuthenticatedAdmin {
    return {
      id: staff.id,
      email: staff.email,
      first_name: staff.first_name,
      last_name: staff.last_name,
      role: staff.role,
    };
  }

  async login(params: AdminLoginParams): Promise<{ user: AuthenticatedAdmin; session: StaffSession }> {
    const { email, password } = params;

    const staff = await this.staffRepository.findByEmail(email);

    if (!staff) {
      throw Errors.invalidCredentials();
    }

    if (!staff.is_active) {
      throw Errors.adminAccountInactive();
    }

    if (staff.password_hash === null) {
      throw Errors.invalidCredentials();
    }

    const isValid = await verifyPassword(password, staff.password_hash);

    if (!isValid) {
      throw Errors.invalidCredentials();
    }

    const session = await this.staffSessionRepository.create(staff.id);

    return {
      user: this.toAuthenticatedAdmin(staff),
      session,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.adminSessionCacheService.invalidate(sessionId);
    await this.staffSessionRepository.revoke(sessionId);
  }

  async validateSession(sessionId: string): Promise<AuthenticatedAdmin | null> {
    // Check cache first
    const cached = await this.adminSessionCacheService.get(sessionId);

    if (cached !== null) {
      return cached.user;
    }

    // Cache miss - query database
    const sessionWithStaff = await this.staffSessionRepository.findActiveWithStaff(sessionId);

    if (!sessionWithStaff) {
      return null;
    }

    // Check if staff is still active
    if (!sessionWithStaff.staff.is_active) {
      await this.staffSessionRepository.revoke(sessionId);

      return null;
    }

    const user = this.toAuthenticatedAdmin(sessionWithStaff.staff);

    // Cache the session
    await this.adminSessionCacheService.set(sessionId, sessionWithStaff.staff_id, user);

    return user;
  }
}
