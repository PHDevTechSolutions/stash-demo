/**
 * utils/supabase-server.ts
 * Server-side Supabase client using the service role key.
 * NEVER import this in client components — service role key must stay server-only.
 *
 * Falls back to the anon key if SUPABASE_SERVICE_ROLE_KEY is not set,
 * but vault tables should have RLS disabled or the service role key must be provided.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Prefer service role key (bypasses RLS); fall back to anon key
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "[vault] SUPABASE_SERVICE_ROLE_KEY is not set. " +
    "Vault API routes will use the anon key — make sure RLS is disabled on credential_vault and vault_audit_logs tables."
  );
}

export const supabaseServer = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});
