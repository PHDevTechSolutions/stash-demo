/**
 * pages/api/vault/export.ts
 * GET — export all active vault entries as encrypted JSON (admin only).
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer as supabase } from "@/utils/supabase-server";
import { resolveVaultUser, getClientIp, isAdmin } from "@/lib/vault-auth";
import { writeAuditLog } from "@/lib/vault-audit";
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

  if (!isAdmin(user)) {
    return res.status(403).json({ error: "Forbidden — export requires IT Admin, IT Manager, or Super Admin role." });
  }

  try {
    const { data, error } = await supabase
      .from("credential_vault")
      .select(
        "service_name, username, login_url, notes, department, tags, review_date, password_encrypted, iv"
      )
      .eq("referenceid", user.referenceId)
      .eq("is_active", true);

    if (error) throw error;

    const json = JSON.stringify(data ?? [], null, 2);
    const today = new Date().toISOString().slice(0, 10);

    await writeAuditLog({
      credential_id: null,
      user_id: user.userId,
      user_name: user.fullName,
      action: "export",
      ip_address: getClientIp(req),
    });

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="vault-export-${today}.json"`);
    return res.status(200).send(json);
  } catch (err: any) {
    console.error("[vault/export]", err.message);
    return res.status(500).json({ error: "Failed to generate export." });
  }
}
