import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { configuration } from './config/configuration';
import { DatabaseModule, PrismaModule, CacheModule, EmailModule, StorageModule, LoggerModule } from '@app/shared';
import { AuthDomainModule } from '@app/auth';
import { AuthHttpModule } from './modules/auth/auth.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { HealthModule } from './modules/health/health.module';
import { VideosModule } from './modules/videos/videos.module';
import { CoursesModule } from './modules/courses/courses.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { AssistantModule } from './modules/assistant/assistant.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Schedule module for cron jobs
    ScheduleModule.forRoot(),

    // Logger
    LoggerModule.forRoot('main-panel'),

    // Shared infrastructure modules
    DatabaseModule,
    PrismaModule,
    CacheModule,
    EmailModule,
    StorageModule,

    // Domain service libs
    AuthDomainModule,

    // App-specific HTTP modules
    AuthHttpModule,
    JobsModule,
    HealthModule,
    VideosModule,
    CoursesModule,
    CheckoutModule,
    OnboardingModule,
    AssistantModule,
  ],
})
export class MainPanelAppModule {}
