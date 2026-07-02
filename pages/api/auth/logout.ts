/**
 * pages/api/auth/logout.ts
 * POST — destroys the session cookie and optionally logs the activity.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed." });
  }

  // Expire the session cookie immediately
  res.setHeader(
    "Set-Cookie",
    serialize("session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "strict",
      maxAge: 0,       // expire immediately
      expires: new Date(0),
      path: "/",
    })
  );

  return res.status(200).json({ message: "Logged out." });
}
