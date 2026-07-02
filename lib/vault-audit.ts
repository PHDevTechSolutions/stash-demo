/**
 * lib/vault-audit.ts
 * Writes audit log entries to the vault_audit_logs Supabase table.
 * Failures are logged to the server console but never block the primary operation.
 */

import { supabaseServer as supabase } from "@/utils/supabase-server";

export type VaultAction =
  | "view"
  | "reveal"
  | "copy"
  | "add"
  | "edit"
  | "delete"
  | "import"
  | "export";

export interface AuditLogEntry {
  credential_id?: number | null;
  user_id: string;
  user_name: string;
  action: VaultAction;
  ip_address: string;
}

/**
 * Writes an audit log entry. Silently handles errors.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const { error } = await supabase.from("vault_audit_logs").insert({
      credential_id: entry.credential_id ?? null,
      user_id: entry.user_id,
      user_name: entry.user_name,
      action: entry.action,
      ip_address: entry.ip_address,
      timestamp: new Date().toISOString(),
    });
    if (error) {
      console.error("[vault-audit] Failed to write audit log:", error.message);
    }
  } catch (err: any) {
    console.error("[vault-audit] Exception writing audit log:", err?.message ?? err);
  }
}
