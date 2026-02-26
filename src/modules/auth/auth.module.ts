import { Module } from '@nestjs/common';

// Controller
import { AuthController } from './infrastructure/controllers/auth.controller';

// Application Services
import { EmailAuthService } from './application/services/email-auth.service';
import { OAuthService } from './application/services/oauth.service';
import { PasswordResetService } from './application/services/password-reset.service';

// Domain Services
import { SessionCacheService } from './domain/services/session-cache.service';

// Infrastructure - Repositories
import { CustomerRepository } from './infrastructure/persistence/customer.repository';
import { SessionRepository } from './infrastructure/persistence/session.repository';
import { OAuthAccountRepository } from './infrastructure/persistence/oauth-account.repository';

// Guards
import { SessionGuard, OptionalSessionGuard } from '@/shared/guards/session.guard';
import { ThrottleGuard } from '@/shared/guards/throttle.guard';

/**
 * Auth Module
 * Combines all auth-related functionality
 */
@Module({
  controllers: [AuthController],
  providers: [
    // Application Services
    {
      provide: 'EmailAuthService',
      useClass: EmailAuthService,
    },
    EmailAuthService,
    OAuthService,
    PasswordResetService,

    // Domain Services
    SessionCacheService,

    // Infrastructure - Repositories
    CustomerRepository,
    SessionRepository,
    OAuthAccountRepository,

    // Guards
    SessionGuard,
    OptionalSessionGuard,
    ThrottleGuard,
  ],
  exports: [
    // Export services for use in other modules
    EmailAuthService,
    'EmailAuthService',
    OAuthService,
    PasswordResetService,
    SessionCacheService,

    // Export repositories for jobs module
    SessionRepository,
    CustomerRepository,
  ],
})
export class AuthModule {}
