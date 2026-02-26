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

  constructor(
    code: AuthErrorCode,
    message: string,
    statusCode = 400,
    details?: Record<string, unknown>,
  ) {
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
  emailAlreadyExists: (): AuthException =>
    new AuthException(AuthErrorCode.EMAIL_ALREADY_EXISTS, 'Email already registered', 409),

  invalidEmail: (): AuthException =>
    new AuthException(AuthErrorCode.INVALID_EMAIL, 'Invalid email format', 400),

  weakPassword: (reason: string): AuthException =>
    new AuthException(AuthErrorCode.WEAK_PASSWORD, `Password does not meet requirements: ${reason}`, 400),

  invalidCredentials: (): AuthException =>
    new AuthException(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid email or password', 401),

  accountNotFound: (): AuthException =>
    new AuthException(AuthErrorCode.ACCOUNT_NOT_FOUND, 'Account not found', 404),

  sessionInvalid: (): AuthException =>
    new AuthException(AuthErrorCode.SESSION_INVALID, 'Invalid session', 401),

  sessionExpired: (): AuthException =>
    new AuthException(AuthErrorCode.SESSION_EXPIRED, 'Session has expired', 401),

  oauthStateInvalid: (): AuthException =>
    new AuthException(AuthErrorCode.OAUTH_STATE_INVALID, 'Invalid OAuth state', 400),

  oauthStateExpired: (): AuthException =>
    new AuthException(AuthErrorCode.OAUTH_STATE_EXPIRED, 'OAuth state has expired', 400),

  oauthProviderError: (provider: string, reason: string): AuthException =>
    new AuthException(
      AuthErrorCode.OAUTH_PROVIDER_ERROR,
      `OAuth error from ${provider}: ${reason}`,
      400,
    ),

  oauthEmailRequired: (provider: string): AuthException =>
    new AuthException(
      AuthErrorCode.OAUTH_EMAIL_REQUIRED,
      `${provider} account does not have a verified email`,
      400,
    ),

  validationError: (message: string, details?: Record<string, unknown>): AuthException =>
    new AuthException(AuthErrorCode.VALIDATION_ERROR, message, 400, details),

  rateLimited: (retryAfter?: number): AuthException =>
    new AuthException(
      AuthErrorCode.RATE_LIMITED,
      'Too many requests, please try again later',
      429,
      retryAfter !== undefined ? { retryAfter } : undefined,
    ),

  unauthorized: (): AuthException =>
    new AuthException(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401),

  forbidden: (): AuthException =>
    new AuthException(AuthErrorCode.FORBIDDEN, 'Access denied', 403),

  internal: (message = 'Internal server error'): AuthException =>
    new AuthException(AuthErrorCode.INTERNAL_ERROR, message, 500),

  otpInvalid: (): AuthException =>
    new AuthException(AuthErrorCode.OTP_INVALID, 'Invalid verification code', 400),

  otpExpired: (): AuthException =>
    new AuthException(AuthErrorCode.OTP_EXPIRED, 'Verification code has expired', 400),

  otpMaxAttempts: (): AuthException =>
    new AuthException(AuthErrorCode.OTP_MAX_ATTEMPTS, 'Too many verification attempts', 429),

  tokenInvalidOrExpired: (): AuthException =>
    new AuthException(AuthErrorCode.TOKEN_INVALID, 'Invalid or expired reset token', 400),

  passwordSameAsOld: (): AuthException =>
    new AuthException(AuthErrorCode.PASSWORD_SAME_AS_OLD, 'New password cannot be the same as your current password', 400),

  passwordResetMaxAttempts: (): AuthException =>
    new AuthException(AuthErrorCode.PASSWORD_RESET_MAX_ATTEMPTS, 'Too many failed attempts. Please request a new password reset link.', 400),

  passwordResetRequired: (email: string): AuthException =>
    new AuthException(AuthErrorCode.PASSWORD_RESET_REQUIRED, 'Password reset is required for this account', 403, { email }),
};
