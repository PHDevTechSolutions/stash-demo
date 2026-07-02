/**
 * pages/api/vault/reminders.ts
 * GET — returns entries expiring within 30 days and sends emails for milestones.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer as supabase } from "@/utils/supabase-server";
import { resolveVaultUser } from "@/lib/vault-auth";
import { applySecurityHeaders } from "@/lib/vault-headers";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const MILESTONE_DAYS = [30, 14, 7];

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

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

  try {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const cutoff = new Date(today);
    cutoff.setUTCDate(cutoff.getUTCDate() + 30);

    const { data: entries, error } = await supabase
      .from("credential_vault")
      .select("id, service_name, review_date, created_by")
      .eq("referenceid", user.referenceId)
      .eq("is_active", true)
      .not("review_date", "is", null);

    if (error) throw error;

    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const upcoming: { id: number; service_name: string; review_date: string; days: number }[] = [];

    for (const entry of entries ?? []) {
      if (!entry.review_date) continue;
      const rd = new Date(entry.review_date);
      if (isNaN(rd.getTime())) continue;
      const rdUtc = new Date(Date.UTC(rd.getUTCFullYear(), rd.getUTCMonth(), rd.getUTCDate()));
      if (rdUtc <= today) continue; // expired — skip
      if (rdUtc > cutoff) continue; // beyond 30 days — skip
      const days = daysBetween(today, rdUtc);
      upcoming.push({ id: entry.id, service_name: entry.service_name, review_date: entry.review_date, days });

      // Send email on milestone days — look up creator email directly from MongoDB
      if (MILESTONE_DAYS.includes(days) && entry.created_by) {
        try {
          const db = await connectToDatabase();
          const creator = await db.collection("users").findOne(
            { _id: new ObjectId(entry.created_by) },
            { projection: { Email: 1 } }
          );
          const toEmail = creator?.Email;
          if (toEmail) {
            await resend.emails.send({
              from: "Stash Vault <no-reply@elev8solutions.cloud>",
              to: [toEmail],
              subject: `⚠️ Credential Review Due in ${days} Days — ${entry.service_name}`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #eee;padding:20px">
                <h2 style="color:#f87171">Credential Review Reminder</h2>
                <p>The credential <strong>${entry.service_name}</strong> is due for review in <strong>${days} days</strong> (${entry.review_date}).</p>
                <p>Please log in to Stash and rotate or review this credential.</p>
                <hr style="border:0;border-top:1px solid #eee;margin:20px 0"/>
                <p style="font-size:12px;color:#999">Stash IT Asset Management System</p>
              </div>`,
            });
          }
        } catch {
          // Email send failure is non-blocking
        }
      }
    }

    return res.status(200).json({ data: upcoming, count: upcoming.length });
  } catch (err: any) {
    console.error("[vault/reminders]", err.message, err.stack);
    return res.status(500).json({ error: "Failed to fetch reminders.", detail: err.message });
  }
}
