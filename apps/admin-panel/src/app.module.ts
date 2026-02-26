import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { configuration } from './config/configuration';
import { DatabaseModule, PrismaModule, CacheModule, EmailModule, StorageModule, LoggerModule } from '@app/shared';
import { AuthDomainModule } from '@app/auth';
import { HealthModule } from './modules/health/health.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { PostsModule } from './modules/posts/posts.module';
import { CustomersModule } from './modules/customers/customers.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { VideosModule } from './modules/videos/videos.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TagsModule } from './modules/tags/tags.module';
import { CoursesModule } from './modules/courses/courses.module';
import { ProductsModule } from './modules/products/products.module';
import { SubscriptionPlansModule } from './modules/subscription-plans/subscription-plans.module';
import { AdminSessionGuard } from './guards/admin-session.guard';
import { RoleGuard } from './guards/role.guard';
import { ThrottleGuard } from '@app/shared/guards/throttle.guard';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Logger
    LoggerModule.forRoot('admin-panel'),

    // Shared infrastructure modules
    DatabaseModule,
    PrismaModule,
    CacheModule,
    EmailModule,
    StorageModule,

    // Domain service libs
    AuthDomainModule,

    // App-specific HTTP modules
    HealthModule,
    AdminAuthModule,
    PostsModule,
    CustomersModule,
    AdminUsersModule,
    VideosModule,
    CategoriesModule,
    TagsModule,
    CoursesModule,
    ProductsModule,
    SubscriptionPlansModule,
  ],
  providers: [
    // Global guards (order matters: throttle -> session -> role)
    { provide: APP_GUARD, useClass: ThrottleGuard },
    { provide: APP_GUARD, useClass: AdminSessionGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
  ],
})
export class AdminPanelAppModule {}
