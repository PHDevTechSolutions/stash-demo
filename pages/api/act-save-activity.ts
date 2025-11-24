import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";

// Converts undefined or empty string → null
const safe = (v: any) => (v === undefined || v === "" ? null : v);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const {
      referenceid,
      tsm,
      manager,
      target_quota,
      type_client,
      activity_reference_number,
      account_reference_number,
      status,
      type_activity,
      source,
      callback,
      call_status,
      call_type,
      product_category,
      project_type,
      project_name,
      quotation_number,
      quotation_amount,
      so_number,
      so_amount,
      date_followup,
      remarks,
      start_date,
      end_date,
      date_created,
      date_updated,
    } = req.body;

    // -----------------------------
    // 🔍 VALIDATION (required fields only)
    // -----------------------------
    if (!activity_reference_number) {
      return res.status(400).json({ error: "Missing activity_reference_number" });
    }
    if (!account_reference_number) {
      return res.status(400).json({ error: "Missing account_reference_number" });
    }
    if (!status) {
      return res.status(400).json({ error: "Missing status" });
    }
    if (!type_activity) {
      return res.status(400).json({ error: "Missing type_activity" });
    }

    // -----------------------------
    // ✅ SAFE INSERT (no undefined ever)
    // -----------------------------
    const { data, error } = await supabase
      .from("history")
      .insert({
        referenceid: safe(referenceid),
        tsm: safe(tsm),
        manager: safe(manager),
        target_quota: safe(target_quota),
        type_client: safe(type_client),
        activity_reference_number,
        account_reference_number,
        status,
        type_activity,
        source: safe(source),
        callback: safe(callback),
        call_status: safe(call_status),
        call_type: safe(call_type),
        product_category: safe(product_category),
        project_type: safe(project_type),
        project_name: safe(project_name),
        quotation_number: safe(quotation_number),
        quotation_amount: safe(quotation_amount),
        so_number: safe(so_number),
        so_amount: safe(so_amount),
        date_followup: safe(date_followup),
        remarks: safe(remarks),
        start_date: safe(start_date),
        end_date: safe(end_date),
        date_created: safe(date_created),
        date_updated: safe(date_updated),
      })
      .select();

    // Supabase error handler
    if (error) {
      console.error("Supabase Insert Error:", error);
      return res.status(500).json({ error: error.message });
    }

    // Success
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: "Server Error" });
  }
}
