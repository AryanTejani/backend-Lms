// Infrastructure modules
export { DatabaseModule } from './database/database.module';
export { DatabaseService } from './database/database.service';
export { PrismaModule } from './prisma/prisma.module';
export { PrismaService } from './prisma/prisma.service';
export { LoggerModule } from './logger/logger.module';
export { LoggerService } from './logger/logger.service';
export { CacheModule } from './cache/cache.module';
export { CacheService } from './cache/cache.service';
export type {
  CachedSession,
  AuthenticatedUser as CacheAuthenticatedUser,
  CachedAdminSession,
  AuthenticatedAdmin as CacheAuthenticatedAdmin,
  OAuthState,
  RateLimitResult,
  PasswordResetTokenData,
} from './cache/cache.service';
export { EmailModule } from './email/email.module';
export { EmailService } from './email/email.service';
export { StorageModule } from './storage/storage.module';
export { StorageService } from './storage/storage.service';
export type { BunnyStorageZone } from './storage/storage.service';
export { VideoService } from './storage/video.service';
export type {
  BunnyStreamLibrary,
  BunnyVideo,
  BunnyVideoListResponse,
  BunnyStatusResponse,
  BunnyCaption,
  BunnyChapter,
  BunnyMoment,
  BunnyMetaTag,
} from './storage/video.service';

// Config
export { sharedConfiguration } from './config/shared-configuration';
export type { SharedConfigShape } from './config/shared-configuration';

// Exceptions & Filters
export { AuthException, AuthErrorCode, Errors } from './exceptions/auth.exception';
export { AuthExceptionFilter } from './filters/auth-exception.filter';

// Guards
export { ThrottleGuard, Throttle, ThrottlePresets } from './guards/throttle.guard';
export type { ThrottleOptions } from './guards/throttle.guard';

// Pipes
export { ZodValidationPipe, ZodValidation } from './pipes/zod-validation.pipe';

// Decorators
export { Public, IS_PUBLIC_KEY } from './decorators/public.decorator';

// Utils
export {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  hashToken,
  generateCodeVerifier,
  generateCodeChallenge,
  generateOAuthState,
} from './utils/crypto.util';
export { generateUuidV7, isValidUuid } from './utils/uuid.util';
