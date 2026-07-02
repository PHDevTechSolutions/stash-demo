/**
 * pages/api/vault/entries.ts
 * GET  — list all active vault entries for the user's referenceid (no passwords)
 * POST — create a new vault entry
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { supabaseServer as supabase } from "@/utils/supabase-server";
import { encrypt, hmacHash } from "@/lib/vault-crypto";
import { analyzeStrength } from "@/lib/vault-strength";
import { resolveVaultUser, getClientIp, isAdmin } from "@/lib/vault-auth";
import { writeAuditLog } from "@/lib/vault-audit";
import { applySecurityHeaders } from "@/lib/vault-headers";

// ─── Zod schema ───────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  service_name: z.string().min(1).max(255),
  login_url: z.string().max(2000).optional().nullable(),
  username: z.string().max(255).optional().nullable(),
  password: z.string().min(1),
  notes: z.string().max(2000).optional().nullable(),
  department: z.string().optional().nullable().transform((v) => {
    if (!v || v.trim() === "") return null;
    const valid = ["IT", "HR", "ADMIN", "FINANCE", "MARKETING", "GENERAL"];
    return valid.includes(v.trim().toUpperCase()) ? v.trim().toUpperCase() : null;
  }),
  tags: z.array(z.string()).max(20).optional().nullable(),
  is_favorite: z.boolean().optional().default(false),
  review_date: z.string().optional().nullable().transform((v) => (!v || v.trim() === "" ? null : v)),
  allowed_roles: z.array(z.string()).optional().default([]),
}).strict();

// ─── Sanitize helper ──────────────────────────────────────────────────────────

function sanitizeString(val: unknown): string | null | undefined {
  if (val == null) return val as null | undefined;
  const s = String(val);
  if (s.includes("\u0000")) return null; // will be caught by caller
  return s.trim();
}

function containsNullByte(obj: Record<string, unknown>): string | null {
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === "string" && val.includes("\u0000")) return key;
  }
  return null;
}

// ─── Body size guard ──────────────────────────────────────────────────────────

const MAX_BODY = 1024 * 1024; // 1 MB

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  applySecurityHeaders(res);

  // ── Auth ──────────────────────────────────────────────────────────────────
  let user: Awaited<ReturnType<typeof resolveVaultUser>>;
  try {
    user = await resolveVaultUser(req);
  } catch (err: any) {
    return res.status(err.statusCode ?? 401).json({ error: err.message });
  }

  const ip = getClientIp(req);

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/vault/entries
  // ─────────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      // Fetch all active entries for the org first, then filter by dept/role in JS.
      // Using PostgREST .or() with JSONB containment is fragile with special chars in position names.
      const { data: allData, error } = await supabase
        .from("credential_vault")
        .select(
          "id, service_name, login_url, username, notes, department, tags, is_favorite, password_strength, review_date, allowed_roles, is_active, created_by, updated_by, created_at, updated_at"
        )
        .eq("referenceid", user.referenceId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      const VALID_DEPTS = ["IT", "HR", "ADMIN", "FINANCE", "MARKETING", "GENERAL"];
      const userDeptNorm = (user.department || "").trim().toUpperCase();

      // Admins see all org entries. Others see entries where:
      //   - department matches theirs, OR
      //   - department is null/empty (uncategorized), OR
      //   - they are in allowed_roles, OR
      //   - they created the entry
      const data = (allData ?? []).filter((e: any) => {
        if (isAdmin(user)) return true;
        if (!e.department || !VALID_DEPTS.includes(e.department)) return true; // uncategorized
        if (userDeptNorm && e.department === userDeptNorm) return true;
        if (Array.isArray(e.allowed_roles) && e.allowed_roles.includes(user.position)) return true;
        if (e.created_by === user.userId) return true;
        return false;
      });

      if (error) throw error;

      // Normalize: ensure tags is always string[], allowed_roles is always array
      const normalized = (data ?? []).map((e: any) => ({
        ...e,
        tags: Array.isArray(e.tags) ? e.tags : (e.tags ? String(e.tags).split(",").map((t: string) => t.trim()).filter(Boolean) : []),
        allowed_roles: Array.isArray(e.allowed_roles) ? e.allowed_roles : [],
      }));

      // Audit: view
      await writeAuditLog({
        credential_id: null,
        user_id: user.userId,
        user_name: user.fullName,
        action: "view",
        ip_address: ip,
      });

      return res.status(200).json({ data: normalized });
    } catch (err: any) {
      console.error("[vault/entries GET]", err.message, err.stack);
      return res.status(500).json({ error: "Failed to fetch vault entries.", detail: err.message });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/vault/entries
  // ─────────────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    // Null byte check
    const nullField = containsNullByte(req.body ?? {});
    if (nullField) {
      return res.status(400).json({ error: `Field '${nullField}' contains an invalid null byte.` });
    }

    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed.",
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const input = parsed.data;
    // dept: use form value if valid, else user's department if valid, else null
    const VALID_DEPTS = ["IT", "HR", "ADMIN", "FINANCE", "MARKETING", "GENERAL"];
    const deptRaw = (input.department || user.department || "").trim().toUpperCase();
    const dept: string | null = VALID_DEPTS.includes(deptRaw) ? deptRaw : null;

    // Authorization: admin or same department (skip check if no dept restriction)
    if (!isAdmin(user) && dept !== null && user.department && user.department !== dept) {
      return res.status(403).json({ error: "Forbidden — cannot create entries for other departments." });
    }

    try {
      const { encrypted, iv } = encrypt(input.password);
      const strength = analyzeStrength(input.password);

      // Reuse detection
      let reuseWarning: string[] = [];
      try {
        const hash = hmacHash(input.password);
        const { data: allEntries } = await supabase
          .from("credential_vault")
          .select("id, service_name, password_hash")
          .eq("referenceid", user.referenceId)
          .eq("is_active", true);

        if (allEntries) {
          reuseWarning = allEntries
            .filter((e: any) => e.password_hash && e.password_hash === hash)
            .map((e: any) => e.service_name);
        }
      } catch {
        // Reuse detection failure is non-blocking
      }

      // Build insert payload — only include columns guaranteed to exist
      const insertPayload: Record<string, unknown> = {
        referenceid: user.referenceId,
        service_name: input.service_name.trim(),
        login_url: input.login_url?.trim() ?? null,
        username: input.username?.trim() ?? null,
        password_encrypted: encrypted,
        iv,
        notes: input.notes?.trim() ?? null,
        department: dept ?? "GENERAL",
        // tags column is text[] — pass array directly
        tags: Array.isArray(input.tags) ? input.tags : [],
        is_favorite: input.is_favorite ?? false,
        password_strength: strength,
        review_date: input.review_date ?? null,
        // allowed_roles column is json — store as JSON array
        allowed_roles: input.allowed_roles ?? [],
        is_active: true,
        created_by: user.userId,
        updated_by: user.userId,
      };

      // password_hash column is optional — only add if VAULT_HMAC_SECRET is set
      try {
        insertPayload.password_hash = hmacHash(input.password);
      } catch {
        // Column may not exist or secret not set — skip silently
      }

      const { data: inserted, error } = await supabase
        .from("credential_vault")
        .insert(insertPayload)
        .select("id")
        .single();

      if (error) throw error;

      await writeAuditLog({
        credential_id: inserted?.id ?? null,
        user_id: user.userId,
        user_name: user.fullName,
        action: "add",
        ip_address: ip,
      });

      return res.status(201).json({
        message: "Vault entry created.",
        id: inserted?.id,
        ...(reuseWarning.length > 0 ? { reuse_warning: reuseWarning } : {}),
      });
    } catch (err: any) {
      console.error("[vault/entries POST]", err.message, JSON.stringify(err));
      return res.status(500).json({ error: "Failed to create vault entry.", detail: err.message, code: err.code });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
