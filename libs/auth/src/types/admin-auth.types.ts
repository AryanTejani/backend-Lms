/**
 * Admin Auth Types
 * Staff-based auth types for the admin panel
 */

// Database types
export interface StaffUser {
  id: string;
  email: string;
  password_hash: string | null;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'instructor';
  is_active: boolean;
  bio: string | null;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface StaffSession {
  id: string;
  staff_id: string;
  created_at: Date;
  revoked_at: Date | null;
}

// Request params
export interface AdminLoginParams {
  email: string;
  password: string;
}

// Response types
export interface AuthenticatedAdmin {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'instructor';
}

export interface AdminAuthResponse {
  user: AuthenticatedAdmin;
}

// Session with staff for validation (excludes password_hash for security)
export interface SessionStaffUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'instructor';
  is_active: boolean;
  bio: string | null;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface StaffSessionWithUser extends StaffSession {
  staff: SessionStaffUser;
}
