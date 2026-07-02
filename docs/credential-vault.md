# Credential Vault — Technical Documentation

**Module:** Secure Credential Vault  
**System:** Stash IT Asset Management  
**Built:** July 2026  
**Status:** Production-ready

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Environment Variables](#environment-variables)
5. [File Structure](#file-structure)
6. [Security Model](#security-model)
7. [API Routes](#api-routes)
8. [Frontend Components](#frontend-components)
9. [Key Behaviors](#key-behaviors)
10. [Known Constraints](#known-constraints)
11. [Setup Checklist](#setup-checklist)

---

## Overview

The Credential Vault is a secure, encrypted password/credential manager built directly into the Stash IT Asset Management system. It allows IT teams to store, share, and audit organizational credentials (service logins, server passwords, API keys, etc.) without relying on spreadsheets or insecure sharing methods.

**Core features:**
- AES-256-CBC encryption — all passwords encrypted at rest, never stored in plaintext
- Role-based and department-scoped access control
- Identity verification (account password) required before revealing or copying passwords
- Auto-lock after 15 minutes of inactivity
- Full audit log of every view, reveal, copy, add, edit, delete, import, and export
- Security health dashboard (weak/expired/reused password counts)
- Expiry reminders via Sonner toasts and Resend email at 30/14/7-day milestones
- Import from JSON or CSV, export as encrypted JSON (admin only)
- Accessible at `/asset/credential-vault` under the Asset Management sidebar section

---

## Architecture

```
Browser (Next.js Client Components)
    │
    ├── /asset/credential-vault          ← Page (app router)
    ├── components/credential-vault.tsx  ← Main UI component
    ├── components/vault-entry-dialog.tsx ← Add/Edit credential form
    └── components/vault-import-dialog.tsx ← CSV/JSON import form
           │
           │  HTTP (API routes — Pages Router)
           ▼
    pages/api/vault/
    ├── entries.ts     GET (list) / POST (create)
    ├── entry.ts       PATCH (update) / DELETE (soft-delete)
    ├── reveal.ts      POST — decrypt & return password for display
    ├── copy.ts        POST — decrypt & return password for clipboard
    ├── health.ts      GET — health stats (Redis cached 5 min)
    ├── audit-logs.ts  GET — audit log entries per credential
    ├── reminders.ts   GET — expiry reminders + Resend emails
    ├── import.ts      POST — batch import JSON/CSV
    └── export.ts      GET — encrypted JSON export (admin only)
           │
           ├── Supabase (PostgreSQL) — credential_vault, vault_audit_logs
           ├── MongoDB — user session/auth resolution
           └── Upstash Redis — health stats cache
```

---

## Database Schema

### `credential_vault`

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint` | Primary key, auto-increment |
| `referenceid` | `text` | Organisation scope key (matches all other Stash tables) |
| `service_name` | `text` | Required. Max 255 chars |
| `login_url` | `text` | Optional |
| `username` | `text` | Optional. Max 255 chars |
| `password_encrypted` | `text` | AES-256-CBC ciphertext, base64 encoded |
| `iv` | `text` | Initialization vector, base64 encoded (16 bytes) |
| `password_hash` | `text` | HMAC-SHA256 of plaintext — used for reuse detection only |
| `notes` | `text` | Optional. Max 2000 chars |
| `department` | `text` | CHECK: `NULL OR IN ('IT','HR','ADMIN','FINANCE','MARKETING','GENERAL')` |
| `tags` | `text[]` | Array of tag strings |
| `is_favorite` | `boolean` | Default false |
| `password_strength` | `text` | CHECK: `weak \| fair \| good \| strong` |
| `review_date` | `date` | Optional — triggers expiry reminders |
| `allowed_roles` | `jsonb` | Array of position strings that can access this entry |
| `is_active` | `boolean` | Soft delete flag. Default true |
| `created_by` | `text` | MongoDB user `_id` |
| `updated_by` | `text` | MongoDB user `_id` |
| `created_at` | `timestamptz` | Default `now()` |
| `updated_at` | `timestamptz` | Default `now()` |

**Required SQL fixes after initial table creation:**
```sql
-- Allow NULL department (original schema only allowed the 6 enum values)
ALTER TABLE credential_vault DROP CONSTRAINT IF EXISTS credential_vault_department_check;
ALTER TABLE credential_vault ADD CONSTRAINT credential_vault_department_check
  CHECK (department IS NULL OR department IN ('IT','HR','ADMIN','FINANCE','MARKETING','GENERAL'));

-- Add columns not in original schema
ALTER TABLE credential_vault ADD COLUMN IF NOT EXISTS referenceid TEXT;
ALTER TABLE credential_vault ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Disable RLS (service role key handles auth at API layer)
ALTER TABLE credential_vault DISABLE ROW LEVEL SECURITY;
ALTER TABLE vault_audit_logs DISABLE ROW LEVEL SECURITY;
```

### `vault_audit_logs`

| Column | Type | Notes |
|---|---|---|
| `id` | `int8` | Primary key |
| `credential_id` | `int8` | FK → `credential_vault.id` (nullable) |
| `user_id` | `text` | MongoDB user `_id` |
| `user_name` | `text` | User's full name at time of action |
| `action` | `text` | One of: `view`, `reveal`, `copy`, `add`, `edit`, `delete`, `import`, `export` |
| `ip_address` | `text` | Client IP (IPv6 loopback normalized to `127.0.0.1`) |
| `timestamp` | `timestamptz` | Default `now()` |

---

## Environment Variables

Add these to `.env.local`:

```env
# Supabase service role key — bypasses RLS on vault tables (server-side only)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# AES-256-CBC master encryption key — must be exactly 64 hex characters (32 bytes)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
VAULT_MASTER_KEY=your_64_hex_char_key_here

# HMAC-SHA256 secret for reuse detection — any long random string
# Generate: node -e "console.log(require('crypto').randomBytes(40).toString('hex'))"
VAULT_HMAC_SECRET=your_long_random_secret_here
```

**Security rules:**
- `VAULT_MASTER_KEY` and `VAULT_HMAC_SECRET` must never be committed to source control
- `SUPABASE_SERVICE_ROLE_KEY` must never be prefixed with `NEXT_PUBLIC_` (server-side only)
- Rotating `VAULT_MASTER_KEY` requires re-encrypting all stored passwords

---

## File Structure

```
lib/
├── vault-crypto.ts      AES-256-CBC encrypt/decrypt + HMAC hash
├── vault-auth.ts        Session cookie → MongoDB user resolution
├── vault-strength.ts    Password strength analyzer (shared server + client)
├── vault-headers.ts     CSP / HSTS / XSS security headers
└── vault-audit.ts       Fire-and-forget audit log writer

utils/
└── supabase-server.ts   Server-side Supabase client (service role key)

types/
└── vault.ts             TypeScript interfaces and enums

pages/api/vault/
├── entries.ts
├── entry.ts
├── reveal.ts
├── copy.ts
├── health.ts
├── audit-logs.ts
├── reminders.ts
├── import.ts
├── export.ts
└── debug.ts             (diagnostic — can be deleted in production)

components/
├── credential-vault.tsx
├── vault-entry-dialog.tsx
└── vault-import-dialog.tsx

app/asset/credential-vault/
└── page.tsx
```

---

## Security Model

### Encryption

- Algorithm: **AES-256-CBC**
- Key: 32-byte key from `VAULT_MASTER_KEY` env var (never in DB or code)
- IV: 16-byte random IV generated per encryption — stored in `iv` column
- Ciphertext stored in `password_encrypted` column as base64
- Decryption only happens server-side in `reveal.ts` and `copy.ts`
- Client never receives ciphertext or IV

### Reuse Detection

- HMAC-SHA256 of plaintext using `VAULT_HMAC_SECRET`
- Hash stored in `password_hash` column
- On create/update: all org hashes compared — warning returned if match found
- Hash is one-way — cannot recover password from hash

### Session & Auth

- Session: HTTP-only cookie named `session` containing MongoDB `_id`
- Every API route calls `resolveVaultUser()` which validates the cookie and fetches `Position`, `Department`, `ReferenceID` from MongoDB
- Returns 401 if cookie missing/invalid, 503 if MongoDB unavailable

### Row-Level Access

On GET (list), entries are returned if ANY of these is true:
1. User is an admin (`IT Admin`, `IT Manager`, or `Super Admin`)
2. Entry has no valid department (uncategorized)
3. Entry's `department` matches the user's department
4. User's `Position` is in the entry's `allowed_roles`
5. User created the entry (`created_by === userId`)

On write (create/update/delete), only admins OR same-department users may modify.

### Identity Verification for Reveal/Copy

Before any password is revealed or copied to clipboard:
1. A modal prompts the user to re-enter their account password
2. This calls `/api/auth/login` to validate against MongoDB
3. On success, a 5-minute verification window is granted (client-side `verifiedUntil` ref)
4. Subsequent reveal/copy within the window skip the prompt
5. The vault auto-lock resets the window

### Security Headers

Applied to every vault API response:
```
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-XSS-Protection: 1; mode=block
```

---

## API Routes

All routes are under `pages/api/vault/` and use the Pages Router `NextApiRequest` / `NextApiResponse` pattern.

### `GET /api/vault/entries`
Returns all active vault entries for the authenticated user's org (no passwords).

### `POST /api/vault/entries`
Creates a new vault entry. Validates with Zod, encrypts password, runs reuse detection.

**Body:**
```json
{
  "service_name": "GitHub",
  "password": "MyS3cur3P@ss",
  "login_url": "https://github.com",
  "username": "user@example.com",
  "department": "IT",
  "tags": ["Login", "Server"],
  "is_favorite": false,
  "review_date": "2026-12-01",
  "notes": "Main org GitHub account",
  "allowed_roles": []
}
```

### `PATCH /api/vault/entry?id={id}`
Updates a vault entry. Password re-encrypted only if new `password` field provided.

### `DELETE /api/vault/entry?id={id}`
Soft-deletes an entry (`is_active = false`).

### `POST /api/vault/reveal`
Returns decrypted plaintext password. Logs `reveal` audit event.

**Body:** `{ "id": 123 }`

### `POST /api/vault/copy`
Returns decrypted plaintext password for clipboard use. Logs `copy` audit event.

**Body:** `{ "id": 123 }`

### `GET /api/vault/health`
Returns strength/expiry/reuse counts. Redis-cached 5 minutes per `referenceid`.

**Response:**
```json
{ "total": 12, "weak": 2, "fair": 3, "good": 4, "strong": 3, "expired": 1, "reused": 0 }
```

### `GET /api/vault/audit-logs?credential_id={id}`
Returns last 50 audit entries for a specific credential.

### `GET /api/vault/reminders`
Returns credentials expiring within 30 days. Sends Resend emails at 30/14/7-day milestones.

### `POST /api/vault/import`
Imports credentials from JSON or CSV. Validates all rows before inserting any (atomic).

**Body:** `{ "format": "csv", "content": "..." }`

### `GET /api/vault/export`
Returns encrypted JSON file (admin only). Logs `export` audit event.

---

## Frontend Components

### `credential-vault.tsx`

Main component. Manages all state and renders the full vault UI.

**Key state:**
| State | Purpose |
|---|---|
| `entries` | All fetched vault entries |
| `health` | Health dashboard stats |
| `revealMap` | Map of `id → plaintext` for currently revealed passwords |
| `locked` | Auto-lock state |
| `verifiedUntil` (ref) | Timestamp until identity verification is valid |
| `verifyOpen` | Whether the identity verify modal is open |

**Auto-lock:** 15-minute inactivity timer using `mousemove`, `keydown`, `click`, `scroll`. Shows 2-minute countdown warning. Requires account password to unlock. 3 failed attempts redirects to login.

**Verify gate:** All reveal/copy actions check `verifiedUntil` ref. If expired, shows `VerifyPasswordModal`. 5-minute verification window after success.

**Filter dropdowns:** All three toolbar filters (department, tags, expiry) use custom dark `FilterDropdown` components — no native `<select>` elements.

### `vault-entry-dialog.tsx`

Add/Edit form modal. Features:
- Custom dark department dropdown (no native select)
- Live 4-segment strength bar
- Password generator (20-char, all 4 character classes)
- Tag picker with active state
- Eye toggle + show/hide password
- Notes with character counter
- Favorite toggle in header

### `vault-import-dialog.tsx`

File import modal. Features:
- Auto-detects JSON vs CSV from file extension
- Preview table (passwords masked as `••••••••`)
- Confirm checkbox before import executes

---

## Key Behaviors

### Password Strength Tiers

| Rating | Length | Character Classes |
|---|---|---|
| `weak` | < 8 chars OR only 1 class | any |
| `fair` | 8–11 chars | ≥ 2 classes |
| `good` | 12–15 chars | ≥ 3 classes |
| `strong` | ≥ 16 chars | all 4 (upper, lower, digit, special) |

### Department Handling

When a user selects "Auto" (no department), the API coerces the value:
1. Uses user's MongoDB `Department` field if it matches the valid enum
2. Validates it matches `IT|HR|ADMIN|FINANCE|MARKETING|GENERAL`
3. Falls back to `"GENERAL"` if user's department is empty or invalid

### Tags Storage

The `tags` column is `text[]` (Postgres array). Supabase JS client accepts a plain JS string array and handles serialization automatically.

### IP Address Normalization

`::1` (IPv6 loopback) is normalized to `127.0.0.1` for audit log readability. `::ffff:x.x.x.x` mapped addresses are stripped to just `x.x.x.x`.

### Audit Log Non-Blocking

If writing an audit log entry fails, the error is logged server-side (`console.error`) but the primary operation (create, reveal, etc.) is not rolled back or blocked.

### Redis Cache

Health stats are cached with a 5-minute TTL keyed by `referenceid`. If Redis is unavailable, the route falls back to a live Supabase query and does not return an error to the client.

---

## Known Constraints

1. **`tags` column** — must be `text[]` type in Supabase. If created as plain `text`, the insert will fail with `malformed array literal`.

2. **`department` CHECK constraint** — the original schema only allowed the 6 department values and rejected `NULL`. The constraint must be updated to allow `NULL OR IN (...)` for "Auto" department entries to work.

3. **`referenceid` column** — not included in the original SQL schema provided. Must be added manually: `ALTER TABLE credential_vault ADD COLUMN IF NOT EXISTS referenceid TEXT;`

4. **Supabase anon key** — the shared `utils/supabase.js` client uses the anon/publishable key. Vault API routes use a separate `utils/supabase-server.ts` client with the service role key to bypass RLS.

5. **`VAULT_MASTER_KEY` rotation** — if you change the master key, all existing encrypted passwords become unreadable. You would need to decrypt all entries with the old key and re-encrypt with the new key before switching.

6. **Reminder emails** — `reminders.ts` directly queries MongoDB to resolve creator email addresses (avoids internal `fetch()` loops). The email `from` address is hardcoded to `no-reply@elev8solutions.cloud` — change this if the domain changes.

---

## Setup Checklist

- [ ] Run the Supabase SQL to create `credential_vault` and `vault_audit_logs` tables
- [ ] Run ALTER statements to fix `department` CHECK constraint and add `referenceid`, `password_hash` columns
- [ ] Disable RLS on both tables (`ALTER TABLE ... DISABLE ROW LEVEL SECURITY`)
- [ ] Generate and add `VAULT_MASTER_KEY` (64 hex chars) to `.env.local`
- [ ] Generate and add `VAULT_HMAC_SECRET` (long random string) to `.env.local`
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (from Supabase Dashboard → Project Settings → API)
- [ ] Restart dev server (`npm run dev`) to load new env vars
- [ ] Verify vault loads at `/asset/credential-vault?id={userId}`
- [ ] Test: add a credential, confirm it appears in the table
- [ ] Test: reveal a credential, confirm identity verify modal appears
- [ ] Test: check audit logs expand in the entry row

---

*Documentation generated July 2026 — Stash IT Asset Management*
