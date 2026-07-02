/**
 * pages/api/vault/import.ts
 * POST — import credentials from JSON or CSV.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { supabaseServer as supabase } from "@/utils/supabase-server";
import { encrypt, hmacHash } from "@/lib/vault-crypto";
import { analyzeStrength } from "@/lib/vault-strength";
import { resolveVaultUser, getClientIp, isAdmin } from "@/lib/vault-auth";
import { writeAuditLog } from "@/lib/vault-audit";
import { applySecurityHeaders } from "@/lib/vault-headers";

const MAX_ROWS = 500;

const RowSchema = z
  .object({
    service_name: z.string().min(1).max(255),
    password: z.string().min(1),
    login_url: z.string().max(2000).optional().nullable(),
    username: z.string().max(255).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    department: z.enum(["IT", "HR", "ADMIN", "FINANCE", "MARKETING", "GENERAL", ""]).optional().nullable().transform((v) => (!v || v === "" ? null : v)),
    tags: z.array(z.string()).max(20).optional().nullable(),
    is_favorite: z.boolean().optional().default(false),
    review_date: z.string().optional().nullable(),
    allowed_roles: z.array(z.string()).optional().default([]),
  })
  .strict();

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.replace(/^"|"$/g, "").trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    return obj;
  });
  return { headers, rows };
}

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

  const { format, content } = req.body ?? {};
  if (!format || !content) {
    return res.status(400).json({ error: "format and content are required." });
  }

  let rawRows: unknown[] = [];

  // Parse
  try {
    if (format === "json") {
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) throw new Error("JSON must be an array.");
      rawRows = parsed;
    } else if (format === "csv") {
      const { headers, rows } = parseCsv(content);
      const required = ["service_name", "password"];
      const missing = required.filter((h) => !headers.includes(h));
      if (missing.length) {
        return res.status(400).json({ error: `Missing required CSV columns: ${missing.join(", ")}` });
      }
      rawRows = rows;
    } else {
      return res.status(400).json({ error: "format must be 'json' or 'csv'." });
    }
  } catch (err: any) {
    return res.status(400).json({ error: `Parse error: ${err.message}` });
  }

  if (rawRows.length > MAX_ROWS) {
    return res.status(400).json({ error: `Import exceeds the ${MAX_ROWS}-row limit.` });
  }

  // Validate all rows before inserting
  const rowErrors: { rowIndex: number; errors: Record<string, string[]> }[] = [];
  const validRows: z.infer<typeof RowSchema>[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const result = RowSchema.safeParse(rawRows[i]);
    if (!result.success) {
      rowErrors.push({ rowIndex: i, errors: result.error.flatten().fieldErrors as Record<string, string[]> });
    } else {
      validRows.push(result.data);
    }
  }

  if (rowErrors.length > 0) {
    return res.status(400).json({ error: "Validation failed for some rows.", rowErrors });
  }

  // Insert in transaction (Supabase doesn't expose explicit transactions,
  // so we batch-insert and catch errors atomically)
  try {
    const records = validRows.map((row) => {
      const { encrypted, iv } = encrypt(row.password);
      return {
        referenceid: user.referenceId,
        service_name: row.service_name.trim(),
        login_url: row.login_url?.trim() ?? null,
        username: row.username?.trim() ?? null,
        password_encrypted: encrypted,
        iv,
        password_hash: (() => { try { return hmacHash(row.password); } catch { return null; } })(),
        notes: row.notes?.trim() ?? null,
        department: row.department ?? user.department,
        tags: Array.isArray(row.tags) ? row.tags : [],
        is_favorite: row.is_favorite ?? false,
        password_strength: analyzeStrength(row.password),
        review_date: row.review_date ?? null,
        allowed_roles: row.allowed_roles ?? [],
        is_active: true,
        created_by: user.userId,
        updated_by: user.userId,
      };
    });

    const { error } = await supabase.from("credential_vault").insert(records);
    if (error) throw error;

    await writeAuditLog({
      credential_id: null,
      user_id: user.userId,
      user_name: user.fullName,
      action: "import",
      ip_address: getClientIp(req),
    });

    return res.status(201).json({ message: `Imported ${records.length} entries.`, count: records.length });
  } catch (err: any) {
    console.error("[vault/import]", err.message);
    return res.status(500).json({ error: "Failed to import entries. Transaction rolled back." });
  }
}
