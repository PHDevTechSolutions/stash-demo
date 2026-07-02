/**
 * lib/vault-headers.ts
 * Security headers applied to all Vault API responses.
 * Implements Shield-style protection (CSP, HSTS, XSS, frame deny).
 */

import type { NextApiResponse } from "next";

export function applySecurityHeaders(res: NextApiResponse): void {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains"
  );
  res.setHeader("X-XSS-Protection", "1; mode=block");
}
