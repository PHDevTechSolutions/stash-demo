import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import redis from "@/lib/redis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Kunin ang query parameter: pwede isang string o array ng string
  let { activity_reference_numbers } = req.query;

  if (!activity_reference_numbers) {
    res.status(400).json({ message: "Missing activity_reference_numbers" });
    return;
  }

  // Siguraduhing array ito
  if (typeof activity_reference_numbers === "string") {
    activity_reference_numbers = [activity_reference_numbers];
  }

  const cacheKey = `history:activity_ref_nums:${activity_reference_numbers.join(",")}`;

  try {
    // Check cache first
    const cached = await redis.get(cacheKey);

    if (cached && typeof cached === "string") {
      return res.status(200).json({ data: JSON.parse(cached), cached: true });
    }

    // Fetch from supabase filtering by activity_reference_number IN (...)
    const { data, error } = await supabase
      .from("history")
      .select("*")
      .in("activity_reference_number", activity_reference_numbers);

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    if (data) {
      await redis.set(cacheKey, JSON.stringify(data), { ex: 300 });
    }

    return res.status(200).json({ data, cached: false });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
