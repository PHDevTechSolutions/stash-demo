/**
 * types/vault.ts
 * Shared type definitions for the Credential Vault module.
 */

export type Department =
  | "IT"
  | "HR"
  | "ADMIN"
  | "FINANCE"
  | "MARKETING"
  | "GENERAL";

export type PasswordStrength = "weak" | "fair" | "good" | "strong";

export type VaultAction =
  | "view"
  | "reveal"
  | "copy"
  | "add"
  | "edit"
  | "delete"
  | "import"
  | "export";

export interface VaultEntry {
  id: number;
  service_name: string;
  login_url?: string | null;
  username?: string | null;
  notes?: string | null;
  department?: Department | null;
  tags?: string[] | null;
  is_favorite: boolean;
  password_strength?: PasswordStrength | null;
  review_date?: string | null;
  allowed_roles?: string[];
  is_active: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  // password_encrypted and iv are intentionally omitted from client-facing type
}

export interface VaultAuditLog {
  id: number;
  credential_id?: number | null;
  user_id: string;
  user_name?: string | null;
  action: VaultAction;
  ip_address?: string | null;
  timestamp: string;
}

export interface VaultHealthStats {
  total: number;
  weak: number;
  fair: number;
  good: number;
  strong: number;
  expired: number;
  reused: number;
}

export const DEPARTMENTS: Department[] = [
  "IT",
  "HR",
  "ADMIN",
  "FINANCE",
  "MARKETING",
  "GENERAL",
];

export const TAGS = [
  "Login",
  "Email",
  "Billing",
  "Domain",
  "Server",
  "Database",
  "API",
  "Social",
  "Cloud",
  "Other",
];
