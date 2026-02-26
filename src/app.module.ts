import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { configuration } from './config/configuration';
import { DatabaseModule } from './shared/database/database.module';
import { PrismaModule } from './shared/prisma/prisma.module';
import { CacheModule } from './shared/cache/cache.module';
import { EmailModule } from './shared/email/email.module';
import { AuthModule } from './modules/auth/auth.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // Configuration - preserves exact config structure from Express
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Schedule module for cron jobs
    ScheduleModule.forRoot(),

    // Infrastructure modules
    DatabaseModule,
    PrismaModule,
    CacheModule,
    EmailModule,

    // Feature modules
    AuthModule,
    JobsModule,
    HealthModule,
  ],
})
export class AppModule {}
