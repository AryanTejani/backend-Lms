import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcrypt';

/**
 * Crypto Utilities
 * Preserves all functions from src/utils/crypto.ts
 */

/**
 * Hash a password using bcrypt with configured salt rounds
 */
export async function hashPassword(password: string, saltRounds = 12): Promise<string> {
  return bcrypt.hash(password, saltRounds);
}

/**
 * Compare a password with a hash using constant-time comparison
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a cryptographically secure random token
 */
export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Hash a token using SHA-256
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generate PKCE code verifier for OAuth
 */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Generate PKCE code challenge from verifier (S256 method)
 */
export function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Generate OAuth state parameter
 */
export function generateOAuthState(): string {
  return randomBytes(32).toString('base64url');
}
