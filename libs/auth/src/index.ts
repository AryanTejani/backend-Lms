// Module
export { AuthDomainModule } from './auth.module';

// Customer Services
export { CustomerAuthService } from './services/customer-auth.service';
export { OAuthService } from './services/oauth.service';
export { PasswordResetService } from './services/password-reset.service';
export { SessionCacheService } from './services/session-cache.service';

// Admin Services
export { AdminAuthService } from './services/admin-auth.service';
export { AdminSessionCacheService } from './services/admin-session-cache.service';

// Customer Repositories
export { CustomerRepository } from './repositories/customer.repository';
export { SessionRepository } from './repositories/session.repository';
export { OAuthAccountRepository } from './repositories/oauth-account.repository';

// Admin Repositories
export { StaffRepository } from './repositories/staff.repository';
export { StaffSessionRepository } from './repositories/staff-session.repository';

// Customer Types
export type {
  Customer,
  OAuthAccount,
  Session,
  SignupParams,
  LoginParams,
  OAuthCallbackParams,
  AuthenticatedUser,
  AuthResponse,
  OAuthUrl,
  OAuthState,
  GoogleTokenResponse,
  GoogleUserInfo,
  RateLimitResult,
  SessionWithCustomer,
} from './types/auth.types';

// Admin Types
export type {
  StaffUser,
  StaffSession,
  AdminLoginParams,
  AuthenticatedAdmin,
  AdminAuthResponse,
  StaffSessionWithUser,
} from './types/admin-auth.types';
