/**
 * pages/api/vault/debug.ts
 * TEMPORARY diagnostic endpoint — DELETE after fixing.
 * Visit: /api/vault/debug to see exact error details.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "@/utils/supabase-server";
import { connectToDatabase } from "@/lib/mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const results: Record<string, unknown> = {};

  // 1. Check env vars (existence only, not values)
  results.env = {
    VAULT_MASTER_KEY: !!process.env.VAULT_MASTER_KEY,
    VAULT_MASTER_KEY_length: process.env.VAULT_MASTER_KEY?.length ?? 0,
    VAULT_HMAC_SECRET: !!process.env.VAULT_HMAC_SECRET,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY_length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "MISSING",
    MONGODB_URI: !!process.env.MONGODB_URI,
  };

  // 2. Test Supabase connection to credential_vault
  try {
    const { data, error } = await supabaseServer
      .from("credential_vault")
      .select("*")
      .limit(1);
    results.supabase_vault = error
      ? { error: error.message, code: error.code }
      : { ok: true, rows: data?.length ?? 0, columns: data?.[0] ? Object.keys(data[0]) : "table is empty — run: select column_name from information_schema.columns where table_name='credential_vault'" };
  } catch (e: any) {
    results.supabase_vault = { exception: e.message };
  }

  // 3. Test Supabase connection to vault_audit_logs
  try {
    const { data, error } = await supabaseServer
      .from("vault_audit_logs")
      .select("id")
      .limit(1);
    results.supabase_audit = error ? { error: error.message, code: error.code } : { ok: true, rows: data?.length ?? 0 };
  } catch (e: any) {
    results.supabase_audit = { exception: e.message };
  }

  // 4. Test MongoDB connection + session cookie parsing
  try {
    const rawCookies = req.headers.cookie ?? "";
    const sessionMatch = rawCookies.match(/(?:^|;\s*)session=([^;]+)/);
    const sessionId = sessionMatch ? decodeURIComponent(sessionMatch[1]) : null;
    results.session_cookie = sessionId ? `present (${sessionId.length} chars)` : "MISSING — no session cookie sent";

    if (sessionId) {
      const db = await connectToDatabase();
      const { ObjectId } = await import("mongodb");
      const user = await db.collection("users").findOne({ _id: new ObjectId(sessionId) });
      results.mongodb = user
        ? { ok: true, Position: user.Position, Department: user.Department, ReferenceID: user.ReferenceID }
        : { error: "User not found for session id" };
    }
  } catch (e: any) {
    results.mongodb = { exception: e.message };
  }

  return res.status(200).json(results);
}
