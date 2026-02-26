/**
 * Auth Types
 * Customer-based auth types for the v2 database
 */

// Database types
export interface Customer {
  id: string;
  email: string;
  password_hash: string | null;
  first_name: string | null;
  last_name: string | null;
  stripe_customer_id: string | null;
  requires_password_reset: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface OAuthAccount {
  id: string;
  customer_id: string;
  provider: string;
  provider_account_id: string;
  created_at: Date;
}

export interface Session {
  id: string;
  customer_id: string;
  created_at: Date;
  revoked_at: Date | null;
}

// Request params
export interface SignupParams {
  email: string;
  password: string;
}

export interface LoginParams {
  email: string;
  password: string;
}

export interface OAuthCallbackParams {
  code: string;
  state: string;
}

// Response types
export interface AuthenticatedUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export interface AuthResponse {
  user: AuthenticatedUser;
}

// OAuth types
export interface OAuthUrl {
  url: string;
  state: string;
}

export interface OAuthState {
  provider: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

// Rate limit types
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

// Session with customer for validation
export interface SessionWithCustomer extends Session {
  customer: Customer;
}
