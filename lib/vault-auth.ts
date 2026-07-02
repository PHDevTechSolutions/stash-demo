/**
 * lib/vault-auth.ts
 * Session validation and user resolution for Vault API routes.
 * Reads the "session" cookie (which contains the MongoDB userId),
 * looks up the user, and returns their role/department context.
 */

import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import type { NextApiRequest } from "next";

export interface VaultUser {
  userId: string;
  fullName: string;
  email: string;
  position: string;
  department: string;
  referenceId: string;
}

const ADMIN_POSITIONS = ["IT Admin", "IT Manager", "Super Admin"];

export function isAdmin(user: VaultUser): boolean {
  return ADMIN_POSITIONS.includes(user.position);
}

/**
 * Validates the session cookie and resolves the authenticated user.
 * Returns the user record or throws with an appropriate HTTP status.
 */
export async function resolveVaultUser(req: NextApiRequest): Promise<VaultUser> {
  // Parse cookie manually (cookie package is available but we use raw header to avoid importing)
  const rawCookies = req.headers.cookie ?? "";
  const sessionMatch = rawCookies.match(/(?:^|;\s*)session=([^;]+)/);
  const sessionId = sessionMatch ? decodeURIComponent(sessionMatch[1]) : null;

  if (!sessionId) {
    const err: any = new Error("Unauthorized — no session cookie.");
    err.statusCode = 401;
    throw err;
  }

  let db: Awaited<ReturnType<typeof connectToDatabase>>;
  try {
    db = await connectToDatabase();
  } catch {
    const err: any = new Error("Database unavailable.");
    err.statusCode = 503;
    throw err;
  }

  let user: any;
  try {
    user = await db.collection("users").findOne({ _id: new ObjectId(sessionId) });
  } catch {
    const err: any = new Error("Unauthorized — invalid session.");
    err.statusCode = 401;
    throw err;
  }

  if (!user) {
    const err: any = new Error("Unauthorized — user not found.");
    err.statusCode = 401;
    throw err;
  }

  return {
    userId: user._id.toString(),
    fullName: `${user.Firstname ?? ""} ${user.Lastname ?? ""}`.trim() || user.Email,
    email: user.Email ?? "",
    position: user.Position ?? user.Role ?? "",
    department: user.Department ?? "",
    referenceId: user.ReferenceID ?? "",
  };
}

/**
 * Extracts the client IP from the request.
 * Normalises IPv6 loopback (::1) to 127.0.0.1 for readability.
 */
export function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  let ip: string;
  if (typeof forwarded === "string") ip = forwarded.split(",")[0].trim();
  else if (Array.isArray(forwarded)) ip = forwarded[0].trim();
  else ip = req.socket?.remoteAddress ?? "unknown";

  // Normalise IPv6 loopback to the familiar IPv4 form
  if (ip === "::1" || ip === "::ffff:127.0.0.1") return "127.0.0.1";
  // Strip IPv6-mapped IPv4 prefix  ::ffff:x.x.x.x → x.x.x.x
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  return ip;
}
