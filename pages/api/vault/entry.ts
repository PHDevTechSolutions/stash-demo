/**
 * pages/api/vault/entry.ts
 * PATCH  — update a vault entry
 * DELETE — soft-delete a vault entry
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { supabaseServer as supabase } from "@/utils/supabase-server";
import { encrypt, hmacHash } from "@/lib/vault-crypto";
import { analyzeStrength } from "@/lib/vault-strength";
import { resolveVaultUser, getClientIp, isAdmin } from "@/lib/vault-auth";
import { writeAuditLog } from "@/lib/vault-audit";
import { applySecurityHeaders } from "@/lib/vault-headers";

const UpdateSchema = z
  .object({
    service_name: z.string().min(1).max(255).optional(),
    login_url: z.string().max(2000).optional().nullable(),
    username: z.string().max(255).optional().nullable(),
    password: z.string().min(1).optional(),
    notes: z.string().max(2000).optional().nullable(),
    department: z
      .enum(["IT", "HR", "ADMIN", "FINANCE", "MARKETING", "GENERAL", ""])
      .optional()
      .nullable()
      .transform((v) => (v === "" ? null : v)),
    tags: z.array(z.string()).max(20).optional().nullable(),
    is_favorite: z.boolean().optional(),
    review_date: z.string().optional().nullable().transform((v) => (!v || v.trim() === "" ? null : v)),
    allowed_roles: z.array(z.string()).optional(),
  })
  .strict();

function containsNullByte(obj: Record<string, unknown>): string | null {
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === "string" && val.includes("\u0000")) return key;
  }
  return null;
}

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  applySecurityHeaders(res);

  let user: Awaited<ReturnType<typeof resolveVaultUser>>;
  try {
    user = await resolveVaultUser(req);
  } catch (err: any) {
    return res.status(err.statusCode ?? 401).json({ error: err.message });
  }

  const entryId = req.query.id ? Number(req.query.id) : NaN;
  if (isNaN(entryId)) {
    return res.status(400).json({ error: "Invalid entry id." });
  }

  // Fetch the entry to check existence and department
  const { data: existing, error: fetchErr } = await supabase
    .from("credential_vault")
    .select("id, department, referenceid")
    .eq("id", entryId)
    .eq("is_active", true)
    .single();

  if (fetchErr || !existing) {
    return res.status(404).json({ error: "Vault entry not found." });
  }

  if (existing.referenceid !== user.referenceId) {
    return res.status(403).json({ error: "Forbidden." });
  }

  const ip = getClientIp(req);

  // ── PATCH ────────────────────────────────────────────────────────────────
  if (req.method === "PATCH") {
    const nullField = containsNullByte(req.body ?? {});
    if (nullField) {
      return res.status(400).json({ error: `Field '${nullField}' contains an invalid null byte.` });
    }

    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed.",
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const input = parsed.data;

    // Auth check — allow if admin, same dept, entry has no dept, or user has no dept
    const entryDept = input.department ?? existing.department;
    const VALID_DEPTS = ["IT", "HR", "ADMIN", "FINANCE", "MARKETING", "GENERAL"];
    const userDeptNorm = (user.department || "").trim().toUpperCase();
    const entryDeptNorm = (entryDept || "").trim().toUpperCase();
    const deptMatch = !entryDeptNorm || !userDeptNorm || entryDeptNorm === userDeptNorm || !VALID_DEPTS.includes(entryDeptNorm);
    if (!isAdmin(user) && !deptMatch) {
      return res.status(403).json({ error: "Forbidden — cannot edit entries for other departments." });
    }

    try {
      // Build update payload
      const updatePayload: Record<string, unknown> = {
        updated_by: user.userId,
        updated_at: new Date().toISOString(),
      };

      if (input.service_name !== undefined) updatePayload.service_name = input.service_name.trim();
      if (input.login_url !== undefined) updatePayload.login_url = input.login_url?.trim() ?? null;
      if (input.username !== undefined) updatePayload.username = input.username?.trim() ?? null;
      if (input.notes !== undefined) updatePayload.notes = input.notes?.trim() ?? null;
      if (input.department !== undefined) updatePayload.department = input.department;
      if (input.tags !== undefined) updatePayload.tags = Array.isArray(input.tags) ? input.tags : [];
      if (input.is_favorite !== undefined) updatePayload.is_favorite = input.is_favorite;
      if (input.review_date !== undefined) updatePayload.review_date = input.review_date;
      if (input.allowed_roles !== undefined) updatePayload.allowed_roles = input.allowed_roles;

      // Re-encrypt only if new password provided
      let reuseWarning: string[] = [];
      if (input.password) {
        const { encrypted, iv } = encrypt(input.password);
        updatePayload.password_encrypted = encrypted;
        updatePayload.iv = iv;
        updatePayload.password_strength = analyzeStrength(input.password);
        try {
          const hash = hmacHash(input.password);
          updatePayload.password_hash = hash;
          const { data: allEntries } = await supabase
            .from("credential_vault")
            .select("id, service_name, password_hash")
            .eq("referenceid", user.referenceId)
            .eq("is_active", true)
            .neq("id", entryId);
          if (allEntries) {
            reuseWarning = allEntries
              .filter((e: any) => e.password_hash && e.password_hash === hash)
              .map((e: any) => e.service_name);
          }
        } catch {
          // non-blocking
        }
      }

      console.log("[vault/entry PATCH] entryId:", entryId, "fields:", Object.keys(updatePayload), "hasPassword:", !!input.password);

      const { data: updatedRows, error } = await supabase
        .from("credential_vault")
        .update(updatePayload)
        .eq("id", entryId)
        .select("id, password_strength");

      console.log("[vault/entry PATCH] result:", updatedRows, "error:", error?.message);

      if (error) {
        console.error("[vault/entry PATCH] Supabase update error:", error.message, error.code, error.details);
        throw error;
      }

      if (!updatedRows || updatedRows.length === 0) {
        console.error("[vault/entry PATCH] No rows updated — id:", entryId, "referenceid:", user.referenceId);
        return res.status(404).json({ error: "Entry not found or not updated." });
      }

      await writeAuditLog({
        credential_id: entryId,
        user_id: user.userId,
        user_name: user.fullName,
        action: "edit",
        ip_address: ip,
      });

      return res.status(200).json({
        message: "Vault entry updated.",
        updated_fields: Object.keys(updatePayload).filter(k => !["updated_by","updated_at"].includes(k)),
        ...(reuseWarning.length > 0 ? { reuse_warning: reuseWarning } : {}),
      });
    } catch (err: any) {
      console.error("[vault/entry PATCH]", err.message, err.code, err.details);
      return res.status(500).json({ error: "Failed to update vault entry.", detail: err.message, code: err.code });
    }
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    if (!isAdmin(user) && user.department !== existing.department) {
      return res.status(403).json({ error: "Forbidden." });
    }

    try {
      const { error } = await supabase
        .from("credential_vault")
        .update({ is_active: false, updated_at: new Date().toISOString(), updated_by: user.userId })
        .eq("id", entryId);

      if (error) throw error;

      await writeAuditLog({
        credential_id: entryId,
        user_id: user.userId,
        user_name: user.fullName,
        action: "delete",
        ip_address: ip,
      });

      return res.status(200).json({ message: "Vault entry deleted." });
    } catch (err: any) {
      console.error("[vault/entry DELETE]", err.message);
      return res.status(500).json({ error: "Failed to delete vault entry." });
    }
  }

  res.setHeader("Allow", ["PATCH", "DELETE"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
