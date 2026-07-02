/**
 * pages/api/vault/session-check.ts
 * GET — validates the session cookie is present and resolves to a real user.
 * Used by the vault page on load to block access after logout.
 * Returns 200 if valid, 401 if not.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { resolveVaultUser } from "@/lib/vault-auth";
import { applySecurityHeaders } from "@/lib/vault-headers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  applySecurityHeaders(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await resolveVaultUser(req);
    return res.status(200).json({ ok: true, userId: user.userId });
  } catch (err: any) {
    return res.status(err.statusCode ?? 401).json({ error: err.message });
  }
}
