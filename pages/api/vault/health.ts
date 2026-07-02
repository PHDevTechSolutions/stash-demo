/**
 * pages/api/vault/health.ts
 * GET — returns security health stats for the vault dashboard.
 *       Results are cached in Redis for 5 minutes per referenceid.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer as supabase } from "@/utils/supabase-server";
import { hmacHash } from "@/lib/vault-crypto";
import { resolveVaultUser } from "@/lib/vault-auth";
import { applySecurityHeaders } from "@/lib/vault-headers";
import redis from "@/lib/redis";

const CACHE_TTL = 300; // 5 minutes

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

  const cacheKey = `vault:health:${user.referenceId}`;

  // Try cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }
  } catch {
    // Cache miss — fall through to live query
  }

  try {
    const { data: entries, error } = await supabase
      .from("credential_vault")
      .select("id, password_strength, review_date")
      .eq("referenceid", user.referenceId)
      .eq("is_active", true);

    if (error) throw error;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let weak = 0, fair = 0, good = 0, strong = 0, expired = 0;

    for (const entry of entries ?? []) {
      switch (entry.password_strength) {
        case "weak":   weak++;   break;
        case "fair":   fair++;   break;
        case "good":   good++;   break;
        case "strong": strong++; break;
      }
      if (entry.review_date) {
        const rd = new Date(entry.review_date);
        if (!isNaN(rd.getTime()) && rd < today) expired++;
      }
    }

    // Reuse detection: count entries that share the same password_hash column if it exists
    // Gracefully returns 0 if the column is absent
    let reused = 0;
    try {
      const { data: hashData } = await supabase
        .from("credential_vault")
        .select("password_hash")
        .eq("referenceid", user.referenceId)
        .eq("is_active", true)
        .not("password_hash", "is", null);

      if (hashData && hashData.length > 0) {
        const counts: Record<string, number> = {};
        for (const row of hashData) {
          if (row.password_hash) {
            counts[row.password_hash] = (counts[row.password_hash] ?? 0) + 1;
          }
        }
        reused = Object.values(counts).filter((c) => c > 1).reduce((acc, c) => acc + c, 0);
      }
    } catch {
      // password_hash column may not exist — reuse defaults to 0
    }

    const stats = {
      total: (entries ?? []).length,
      weak,
      fair,
      good,
      strong,
      expired,
      reused,
    };

    // Cache result
    try {
      await redis.set(cacheKey, stats, { ex: CACHE_TTL });
    } catch {
      // Cache write failure is non-critical
    }

    return res.status(200).json(stats);
  } catch (err: any) {
    console.error("[vault/health]", err.message, err.stack);
    return res.status(500).json({ error: "Failed to compute health stats.", detail: err.message });
  }
}
