/**
 * pages/api/vault/reveal.ts
 * POST — decrypt and return the plaintext password for a vault entry.
 *        Logs a 'reveal' audit event.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer as supabase } from "@/utils/supabase-server";
import { decrypt } from "@/lib/vault-crypto";
import { resolveVaultUser, getClientIp } from "@/lib/vault-auth";
import { writeAuditLog } from "@/lib/vault-audit";
import { applySecurityHeaders } from "@/lib/vault-headers";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  applySecurityHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed." });
  }

  let user: Awaited<ReturnType<typeof resolveVaultUser>>;
  try {
    user = await resolveVaultUser(req);
  } catch (err: any) {
    return res.status(err.statusCode ?? 401).json({ error: err.message });
  }

  const { id } = req.body ?? {};
  if (!id) return res.status(400).json({ error: "Entry id is required." });

  const entryId = Number(id);
  if (isNaN(entryId)) return res.status(400).json({ error: "Invalid entry id." });

  try {
    const { data: entry, error } = await supabase
      .from("credential_vault")
      .select("id, password_encrypted, iv, department, allowed_roles, referenceid")
      .eq("id", entryId)
      .eq("is_active", true)
      .single();

    if (error || !entry) {
      return res.status(404).json({ error: "Vault entry not found." });
    }

    if (entry.referenceid !== user.referenceId) {
      return res.status(403).json({ error: "Forbidden." });
    }

    let plaintext: string;
    try {
      plaintext = decrypt(entry.password_encrypted, entry.iv);
    } catch (decryptErr: any) {
      console.error("[vault/reveal] Decryption failed:", decryptErr.message);
      return res.status(500).json({ error: "Failed to decrypt credential." });
    }

    await writeAuditLog({
      credential_id: entryId,
      user_id: user.userId,
      user_name: user.fullName,
      action: "reveal",
      ip_address: getClientIp(req),
    });

    return res.status(200).json({ password: plaintext });
  } catch (err: any) {
    console.error("[vault/reveal]", err.message);
    return res.status(500).json({ error: "Internal server error." });
  }
}
