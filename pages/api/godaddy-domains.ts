import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const apiKey = process.env.GODADDY_API_KEY;
  const apiSecret = process.env.GODADDY_API_SECRET;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: "GoDaddy API credentials are not configured in .env.local" });
  }

  try {
    // We use the production URL. For OTE, use api.ote-godaddy.com
    const response = await fetch("https://api.godaddy.com/v1/domains?statuses=ACTIVE", {
      method: "GET",
      headers: {
        "Authorization": `sso-key ${apiKey}:${apiSecret}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("GoDaddy API error:", errorData);
      return res.status(response.status).json({ error: errorData.message || "Failed to fetch domains from GoDaddy" });
    }

    const domains = await response.json();
    
    // Transform data if needed, but GoDaddy returns a good array of domains
    // [{ domain: "example.com", status: "ACTIVE", expires: "2024-12-01T..." }, ...]
    
    res.status(200).json(domains);
  } catch (error: any) {
    console.error("Error fetching domains:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
