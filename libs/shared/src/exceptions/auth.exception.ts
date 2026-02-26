import { HttpException } from '@nestjs/common';

/**
 * Auth Error Codes
 * Preserves all codes from src/utils/errors.ts
 */
export enum AuthErrorCode {
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  INVALID_EMAIL = 'INVALID_EMAIL',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  SESSION_INVALID = 'SESSION_INVALID',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  OAUTH_STATE_INVALID = 'OAUTH_STATE_INVALID',
  OAUTH_STATE_EXPIRED = 'OAUTH_STATE_EXPIRED',
  OAUTH_PROVIDER_ERROR = 'OAUTH_PROVIDER_ERROR',
  OAUTH_EMAIL_REQUIRED = 'OAUTH_EMAIL_REQUIRED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  OTP_INVALID = 'OTP_INVALID',
  OTP_EXPIRED = 'OTP_EXPIRED',
  OTP_MAX_ATTEMPTS = 'OTP_MAX_ATTEMPTS',
  TOKEN_INVALID = 'TOKEN_INVALID',
  PASSWORD_SAME_AS_OLD = 'PASSWORD_SAME_AS_OLD',
  PASSWORD_RESET_MAX_ATTEMPTS = 'PASSWORD_RESET_MAX_ATTEMPTS',
  PASSWORD_RESET_REQUIRED = 'PASSWORD_RESET_REQUIRED',
  ADMIN_ACCOUNT_INACTIVE = 'ADMIN_ACCOUNT_INACTIVE',
  ADMIN_NOT_FOUND = 'ADMIN_NOT_FOUND',
  EMAIL_ALREADY_IN_USE = 'EMAIL_ALREADY_IN_USE',
  INSUFFICIENT_ROLE = 'INSUFFICIENT_ROLE',
  POST_NOT_FOUND = 'POST_NOT_FOUND',
  VIDEO_NOT_FOUND = 'VIDEO_NOT_FOUND',
  VIDEO_ACCESS_DENIED = 'VIDEO_ACCESS_DENIED',
  COURSE_NOT_FOUND = 'COURSE_NOT_FOUND',
  COURSE_ACCESS_DENIED = 'COURSE_ACCESS_DENIED',
  LESSON_NOT_FOUND = 'LESSON_NOT_FOUND',
  CANNOT_DEACTIVATE_SELF = 'CANNOT_DEACTIVATE_SELF',
  STRIPE_CUSTOMER_CREATION_FAILED = 'STRIPE_CUSTOMER_CREATION_FAILED',
  STRIPE_CHECKOUT_FAILED = 'STRIPE_CHECKOUT_FAILED',
  STRIPE_PORTAL_FAILED = 'STRIPE_PORTAL_FAILED',
  STRIPE_WEBHOOK_INVALID = 'STRIPE_WEBHOOK_INVALID',
  SUBSCRIPTION_NOT_FOUND = 'SUBSCRIPTION_NOT_FOUND',
  PLAN_NOT_FOUND = 'PLAN_NOT_FOUND',
  CUSTOMER_NOT_FOUND = 'CUSTOMER_NOT_FOUND',
  STRIPE_PLAN_SYNC_FAILED = 'STRIPE_PLAN_SYNC_FAILED',
  QUIZ_NOT_FOUND = 'QUIZ_NOT_FOUND',
  QUIZ_QUESTION_NOT_FOUND = 'QUIZ_QUESTION_NOT_FOUND',
  SECTION_NOT_FOUND = 'SECTION_NOT_FOUND',
  TOPIC_NOT_FOUND = 'TOPIC_NOT_FOUND',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  REFUND_FAILED = 'REFUND_FAILED',
  ORDER_NOT_REFUNDABLE = 'ORDER_NOT_REFUNDABLE',
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  ALREADY_PURCHASED = 'ALREADY_PURCHASED',
  SUBSCRIPTION_NOT_CANCELLABLE = 'SUBSCRIPTION_NOT_CANCELLABLE',
  SUBSCRIPTION_CANCEL_FAILED = 'SUBSCRIPTION_CANCEL_FAILED',
}

interface AuthErrorJson {
  error: {
    code: AuthErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * AuthException
 * Preserves behavior from AuthError class in src/utils/errors.ts
 */
export class AuthException extends HttpException {
  public readonly code: AuthErrorCode;
  public readonly details: Record<string, unknown> | undefined;

  constructor(code: AuthErrorCode, message: string, statusCode = 400, details?: Record<string, unknown>) {
    super(message, statusCode);
    this.code = code;
    this.details = details;
  }

  toJSON(): AuthErrorJson {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined && { details: this.details }),
      },
    };
  }
}

/**
 * Errors factory
 * Preserves all factory functions from src/utils/errors.ts
 */
export const Errors = {
  emailAlreadyExists: (): AuthException => new AuthException(AuthErrorCode.EMAIL_ALREADY_EXISTS, 'Email already registered', 409),

  invalidEmail: (): AuthException => new AuthException(AuthErrorCode.INVALID_EMAIL, 'Invalid email format', 400),

  weakPassword: (reason: string): AuthException =>
    new AuthException(AuthErrorCode.WEAK_PASSWORD, `Password does not meet requirements: ${reason}`, 400),

  invalidCredentials: (): AuthException => new AuthException(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid email or password', 401),

  accountNotFound: (): AuthException => new AuthException(AuthErrorCode.ACCOUNT_NOT_FOUND, 'Account not found', 404),

  sessionInvalid: (): AuthException => new AuthException(AuthErrorCode.SESSION_INVALID, 'Invalid session', 401),

  sessionExpired: (): AuthException => new AuthException(AuthErrorCode.SESSION_EXPIRED, 'Session has expired', 401),

  oauthStateInvalid: (): AuthException => new AuthException(AuthErrorCode.OAUTH_STATE_INVALID, 'Invalid OAuth state', 400),

  oauthStateExpired: (): AuthException => new AuthException(AuthErrorCode.OAUTH_STATE_EXPIRED, 'OAuth state has expired', 400),

  oauthProviderError: (provider: string, reason: string): AuthException =>
    new AuthException(AuthErrorCode.OAUTH_PROVIDER_ERROR, `OAuth error from ${provider}: ${reason}`, 400),

  oauthEmailRequired: (provider: string): AuthException =>
    new AuthException(AuthErrorCode.OAUTH_EMAIL_REQUIRED, `${provider} account does not have a verified email`, 400),

  validationError: (message: string, details?: Record<string, unknown>): AuthException =>
    new AuthException(AuthErrorCode.VALIDATION_ERROR, message, 400, details),

  rateLimited: (retryAfter?: number): AuthException =>
    new AuthException(
      AuthErrorCode.RATE_LIMITED,
      'Too many requests, please try again later',
      429,
      retryAfter !== undefined ? { retryAfter } : undefined,
    ),

  unauthorized: (): AuthException => new AuthException(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401),

  forbidden: (): AuthException => new AuthException(AuthErrorCode.FORBIDDEN, 'Access denied', 403),

  internal: (message = 'Internal server error'): AuthException => new AuthException(AuthErrorCode.INTERNAL_ERROR, message, 500),

  otpInvalid: (): AuthException => new AuthException(AuthErrorCode.OTP_INVALID, 'Invalid verification code', 400),

  otpExpired: (): AuthException => new AuthException(AuthErrorCode.OTP_EXPIRED, 'Verification code has expired', 400),

  otpMaxAttempts: (): AuthException => new AuthException(AuthErrorCode.OTP_MAX_ATTEMPTS, 'Too many verification attempts', 429),

  tokenInvalidOrExpired: (): AuthException => new AuthException(AuthErrorCode.TOKEN_INVALID, 'Invalid or expired reset token', 400),

  passwordSameAsOld: (): AuthException =>
    new AuthException(AuthErrorCode.PASSWORD_SAME_AS_OLD, 'New password cannot be the same as your current password', 400),

  passwordResetMaxAttempts: (): AuthException =>
    new AuthException(AuthErrorCode.PASSWORD_RESET_MAX_ATTEMPTS, 'Too many failed attempts. Please request a new password reset link.', 400),

  passwordResetRequired: (): AuthException =>
    new AuthException(AuthErrorCode.PASSWORD_RESET_REQUIRED, 'Password reset is required for this account', 403),

  adminAccountInactive: (): AuthException => new AuthException(AuthErrorCode.ADMIN_ACCOUNT_INACTIVE, 'Account has been deactivated', 403),

  adminNotFound: (): AuthException => new AuthException(AuthErrorCode.ADMIN_NOT_FOUND, 'Admin account not found', 404),

  emailAlreadyInUse: (): AuthException => new AuthException(AuthErrorCode.EMAIL_ALREADY_IN_USE, 'Email is already in use', 409),

  insufficientRole: (): AuthException => new AuthException(AuthErrorCode.INSUFFICIENT_ROLE, 'Insufficient permissions', 403),

  postNotFound: (): AuthException => new AuthException(AuthErrorCode.POST_NOT_FOUND, 'Post not found', 404),

  videoNotFound: (): AuthException => new AuthException(AuthErrorCode.VIDEO_NOT_FOUND, 'Video not found', 404),

  videoAccessDenied: (): AuthException => new AuthException(AuthErrorCode.VIDEO_ACCESS_DENIED, 'You do not have access to this video', 403),

  courseNotFound: (): AuthException => new AuthException(AuthErrorCode.COURSE_NOT_FOUND, 'Course not found', 404),

  courseAccessDenied: (): AuthException => new AuthException(AuthErrorCode.COURSE_ACCESS_DENIED, 'You do not have access to this course', 403),

  lessonNotFound: (): AuthException => new AuthException(AuthErrorCode.LESSON_NOT_FOUND, 'Lesson not found', 404),

  cannotDeactivateSelf: (): AuthException => new AuthException(AuthErrorCode.CANNOT_DEACTIVATE_SELF, 'Cannot deactivate your own account', 400),

  stripeCustomerCreationFailed: (): AuthException =>
    new AuthException(AuthErrorCode.STRIPE_CUSTOMER_CREATION_FAILED, 'Failed to create Stripe customer', 500),

  stripeCheckoutFailed: (reason?: string): AuthException =>
    new AuthException(AuthErrorCode.STRIPE_CHECKOUT_FAILED, reason ?? 'Failed to create checkout session', 500),

  stripePortalFailed: (): AuthException =>
    new AuthException(AuthErrorCode.STRIPE_PORTAL_FAILED, 'Failed to create billing portal session', 500),

  stripeWebhookInvalid: (): AuthException =>
    new AuthException(AuthErrorCode.STRIPE_WEBHOOK_INVALID, 'Invalid webhook signature', 400),

  subscriptionNotFound: (): AuthException =>
    new AuthException(AuthErrorCode.SUBSCRIPTION_NOT_FOUND, 'Subscription not found', 404),

  planNotFound: (): AuthException => new AuthException(AuthErrorCode.PLAN_NOT_FOUND, 'Subscription plan not found', 404),

  customerNotFound: (): AuthException => new AuthException(AuthErrorCode.CUSTOMER_NOT_FOUND, 'Customer not found', 404),

  stripePlanSyncFailed: (reason?: string): AuthException =>
    new AuthException(AuthErrorCode.STRIPE_PLAN_SYNC_FAILED, reason ?? 'Failed to sync plan with Stripe', 500),

  quizNotFound: (): AuthException => new AuthException(AuthErrorCode.QUIZ_NOT_FOUND, 'Quiz not found', 404),

  quizQuestionNotFound: (): AuthException =>
    new AuthException(AuthErrorCode.QUIZ_QUESTION_NOT_FOUND, 'Quiz question not found', 404),

  sectionNotFound: (): AuthException => new AuthException(AuthErrorCode.SECTION_NOT_FOUND, 'Section not found', 404),

  topicNotFound: (): AuthException => new AuthException(AuthErrorCode.TOPIC_NOT_FOUND, 'Topic not found', 404),

  orderNotFound: (): AuthException => new AuthException(AuthErrorCode.ORDER_NOT_FOUND, 'Order not found', 404),

  refundFailed: (reason?: string): AuthException =>
    new AuthException(AuthErrorCode.REFUND_FAILED, reason ?? 'Failed to process refund', 500),

  orderNotRefundable: (): AuthException =>
    new AuthException(AuthErrorCode.ORDER_NOT_REFUNDABLE, 'Order is not eligible for refund', 400),

  productNotFound: (): AuthException => new AuthException(AuthErrorCode.PRODUCT_NOT_FOUND, 'Product not found', 404),

  alreadyPurchased: (): AuthException => new AuthException(AuthErrorCode.ALREADY_PURCHASED, 'You already have access to this product', 409),

  subscriptionNotCancellable: (reason?: string): AuthException =>
    new AuthException(AuthErrorCode.SUBSCRIPTION_NOT_CANCELLABLE, reason ?? 'Subscription is not eligible for cancellation', 400),

  subscriptionCancelFailed: (reason?: string): AuthException =>
    new AuthException(AuthErrorCode.SUBSCRIPTION_CANCEL_FAILED, reason ?? 'Failed to cancel subscription', 500),
};
