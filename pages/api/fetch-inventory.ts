import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { referenceid } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ error: "referenceid query parameter is required" });
  }

  try {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .eq("referenceid", referenceid);

    if (error) {
      console.error("Supabase fetch error:", error);
      return res.status(500).json({ error: "Server error fetching inventory" });
    }

    res.status(200).json({ data });
  } catch (error) {
    console.error("Unexpected error fetching inventory:", error);
    res.status(500).json({ error: "Server error fetching inventory" });
  }
}
