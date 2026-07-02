/**
 * pages/api/vault/audit-logs.ts
 * GET — returns the last 50 audit log entries for a given credential_id.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer as supabase } from "@/utils/supabase-server";
import { resolveVaultUser } from "@/lib/vault-auth";
import { applySecurityHeaders } from "@/lib/vault-headers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  applySecurityHeaders(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed." });
  }

  let user: Awaited<ReturnType<typeof resolveVaultUser>>;
  try {
    user = await resolveVaultUser(req);
  } catch (err: any) {
    return res.status(err.statusCode ?? 401).json({ error: err.message });
  }

  const credentialId = req.query.credential_id
    ? Number(req.query.credential_id)
    : NaN;

  if (isNaN(credentialId)) {
    return res.status(400).json({ error: "credential_id query param is required." });
  }

  // Verify the entry belongs to the user's org
  const { data: entry, error: entryErr } = await supabase
    .from("credential_vault")
    .select("id, referenceid")
    .eq("id", credentialId)
    .single();

  if (entryErr || !entry || entry.referenceid !== user.referenceId) {
    return res.status(404).json({ error: "Vault entry not found." });
  }

  try {
    const { data, error } = await supabase
      .from("vault_audit_logs")
      .select("id, credential_id, user_id, user_name, action, ip_address, timestamp")
      .eq("credential_id", credentialId)
      .order("timestamp", { ascending: false })
      .limit(50);

    if (error) throw error;

    return res.status(200).json({ data: data ?? [] });
  } catch (err: any) {
    console.error("[vault/audit-logs]", err.message);
    return res.status(500).json({ error: "Failed to fetch audit logs." });
  }
}
