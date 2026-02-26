import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/configuration';
import { DatabaseModule, PrismaModule, CacheModule, EmailModule, LoggerModule } from '@app/shared';
import { AuthDomainModule } from '@app/auth';
import { HealthModule } from './modules/health/health.module';

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

    // App-specific HTTP modules
    HealthModule,

    // TODO: Add as implemented:
    // MobileAuthHttpModule,
  ],
})
export class MobileApiAppModule {}
