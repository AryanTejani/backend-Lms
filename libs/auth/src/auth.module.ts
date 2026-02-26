import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/shared/prisma/prisma.module';
import { CacheModule } from '@app/shared/cache/cache.module';
import { EmailModule } from '@app/shared/email/email.module';

// Customer Services
import { CustomerAuthService } from './services/customer-auth.service';
import { OAuthService } from './services/oauth.service';
import { PasswordResetService } from './services/password-reset.service';
import { SessionCacheService } from './services/session-cache.service';

// Admin Services
import { AdminAuthService } from './services/admin-auth.service';
import { AdminSessionCacheService } from './services/admin-session-cache.service';

// Customer Repositories
import { CustomerRepository } from './repositories/customer.repository';
import { SessionRepository } from './repositories/session.repository';
import { OAuthAccountRepository } from './repositories/oauth-account.repository';

// Admin Repositories
import { StaffRepository } from './repositories/staff.repository';
import { StaffSessionRepository } from './repositories/staff-session.repository';

@Module({
  imports: [PrismaModule, CacheModule, EmailModule],
  providers: [
    // Customer Services
    CustomerAuthService,
    {
      provide: 'CustomerAuthService',
      useExisting: CustomerAuthService,
    },
    OAuthService,
    PasswordResetService,
    SessionCacheService,

    // Admin Services
    AdminAuthService,
    {
      provide: 'AdminAuthService',
      useExisting: AdminAuthService,
    },
    AdminSessionCacheService,

    // Customer Repositories
    CustomerRepository,
    SessionRepository,
    OAuthAccountRepository,

    // Admin Repositories
    StaffRepository,
    StaffSessionRepository,
  ],
  exports: [
    // Customer
    CustomerAuthService,
    'CustomerAuthService',
    OAuthService,
    PasswordResetService,
    SessionCacheService,
    CustomerRepository,
    SessionRepository,
    OAuthAccountRepository,

    // Admin
    AdminAuthService,
    'AdminAuthService',
    AdminSessionCacheService,
    StaffRepository,
    StaffSessionRepository,
  ],
})
export class AuthDomainModule {}
