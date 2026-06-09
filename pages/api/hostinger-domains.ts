import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const apiToken = process.env.HOSTINGER_API_TOKEN;

  if (!apiToken) {
    return res.status(500).json({ error: "Hostinger API token is not configured in .env.local" });
  }

  try {
    // Correct base URL based on Hostinger documentation is https://developers.hostinger.com
    const response = await fetch("https://developers.hostinger.com/api/domains/v1/portfolio", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "Failed to fetch domains from Hostinger";
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error?.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      console.error("Hostinger API error:", response.status, errorText);
      return res.status(response.status).json({ error: errorMessage });
    }

    const data = await response.json();
    console.log("Hostinger API response data:", data);
    
    // Hostinger API usually returns the list in 'data' field
    const domains = Array.isArray(data) ? data : (data.data || []);
    
    res.status(200).json(domains);
  } catch (error: any) {
    console.error("Error fetching Hostinger domains:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
