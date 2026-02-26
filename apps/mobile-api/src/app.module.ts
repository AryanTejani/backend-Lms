import { Module } from '@nestjs/common';
import { ContentModule } from '@app/content';
import { CustomerModule } from '@app/customer';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/configuration';
import { DatabaseModule, PrismaModule, CacheModule, EmailModule, LoggerModule } from '@app/shared';
import { AuthDomainModule } from '@app/auth';
import { HealthModule } from './modules/health/health.module';
import { MobileAuthHttpModule } from './modules/auth/mobile-auth.module';
import { MobileContentHttpModule } from './modules/content/mobile-content.module';
import { MobileBillingHttpModule } from './modules/billing/mobile-billing.module';
import { MobileCustomerHttpModule } from './modules/customer/mobile-customer.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Logger
    LoggerModule.forRoot('mobile-api'),

    // Shared infrastructure modules
    DatabaseModule,
    PrismaModule,
    CacheModule,
    EmailModule,

    // Domain service libs
    AuthDomainModule,
    ContentModule,
    CustomerModule,

    // App-specific HTTP modules
    HealthModule,
    MobileAuthHttpModule,
    MobileContentHttpModule,
    MobileBillingHttpModule,
    MobileCustomerHttpModule,
  ],
})
export class MobileApiAppModule { }
