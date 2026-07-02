# Requirements Document

## Introduction

The Credential Vault is a secure, encrypted credential management module integrated directly into the Stash IT Asset Management system. It replaces ad-hoc, unsecured credential sharing by providing AES-256-CBC encrypted storage for organizational secrets (service logins, server credentials, billing accounts, etc.), organized by department, with role-based access control, a full audit trail, and proactive security health monitoring. It is accessible from the Asset Management sidebar section and inherits Stash's existing auth, Supabase, Redis, and Resend infrastructure.

## Glossary

- **Vault**: The Credential Vault module within Stash.
- **Vault_Entry**: A single credential record stored in the `credential_vault` Supabase table, containing service name, encrypted password, IV, metadata, and access controls.
- **Encryptor**: The server-side encryption service that applies AES-256-CBC encryption and decryption using the `VAULT_MASTER_KEY` environment variable.
- **Master_Key**: The AES-256-CBC symmetric key stored exclusively in the `.env.local` environment variable `VAULT_MASTER_KEY`; never persisted to the database or exposed in client-side code.
- **IV**: The initialization vector generated per encryption operation, stored alongside the encrypted ciphertext in the `credential_vault` table.
- **Audit_Log**: A record written to the `vault_audit_logs` Supabase table capturing every vault interaction (view, reveal, copy, add, edit, delete) with user identity, IP address, and timestamp.
- **Password_Strength_Analyzer**: The server-side utility that rates a plaintext password as `weak`, `fair`, `good`, or `strong` based on length, character-class diversity, and entropy heuristics.
- **Reuse_Detector**: The server-side service that hashes a candidate password and compares it against all stored hashes scoped to the same `referenceid` to detect duplicate usage.
- **Health_Dashboard**: The UI panel displaying counts of weak, expired, and duplicate credential entries.
- **Auto_Lock**: The client-side inactivity timer that masks all revealed passwords and displays a lock-screen overlay after 15 minutes of user inactivity.
- **Session**: The existing Stash HTTP-only cookie-based session (`session` cookie), validated on every Vault API request.
- **User**: An authenticated Stash user identified by MongoDB `_id` (userId) passed via query parameter and validated server-side.
- **Department**: One of `IT`, `HR`, `ADMIN`, `FINANCE`, `MARKETING`, or `GENERAL`, used to scope Vault_Entry visibility.
- **Tag**: A label (e.g., `Login`, `Email`, `Billing`, `Domain`, `Server`) attached to a Vault_Entry for grouping and filtering.
- **Review_Date**: The date field on a Vault_Entry indicating when the credential should be rotated or reviewed.
- **Redis_Cache**: The Upstash Redis instance accessed via `lib/redis.ts`, used to cache non-sensitive vault metadata (entry lists without plaintext passwords).
- **Zod_Schema**: A Zod validation schema applied to all API request bodies and form inputs before processing.
- **CSP**: Content Security Policy HTTP response header applied to all Vault API routes.

---

## Requirements

### Requirement 1: Encrypted Credential Storage

**User Story:** As an IT administrator, I want all credential passwords to be encrypted at rest using AES-256-CBC with a master key stored only in environment variables, so that a database breach cannot expose plaintext secrets.

#### Acceptance Criteria

1. WHEN a plaintext password is written to the `credential_vault` table, THE Encryptor SHALL encrypt it using AES-256-CBC with a randomly generated 16-byte IV before writing.
2. WHEN the Encryptor writes an encrypted password, THE Encryptor SHALL store the ciphertext in the `password_encrypted` column and the base64-encoded IV in the `iv` column of the `credential_vault` table.
3. THE Encryptor SHALL read the Master_Key exclusively from the `VAULT_MASTER_KEY` environment variable and SHALL NOT read it from any database table, client-side code, or source file.
4. IF the `VAULT_MASTER_KEY` environment variable is absent, empty, or not exactly 32 bytes when decoded from hex, THEN THE Vault API SHALL return HTTP 500 on the first request and SHALL NOT attempt encryption or decryption until the application is restarted with a valid key.
5. IF the `VAULT_MASTER_KEY` environment variable is absent or empty at application startup, THEN THE Vault API SHALL return HTTP 503 for all subsequent requests without re-attempting key resolution.
6. WHEN the Encryptor decrypts a Vault_Entry, THE Encryptor SHALL use the IV stored in the `iv` column paired with the Master_Key to recover the original plaintext.
7. IF the Encryptor encounters a malformed IV, corrupted ciphertext, or any decryption error, THEN THE Vault API SHALL return HTTP 500 and SHALL NOT return partial plaintext, the raw ciphertext, or the IV in the error response.

---

### Requirement 2: Role-Based and Department-Scoped Access Control

**User Story:** As a department manager, I want access to credentials restricted by user role and department membership, so that employees can only read and modify credentials relevant to their scope.

#### Acceptance Criteria

1. WHEN a User requests any Vault API endpoint, THE Vault API SHALL verify the `session` cookie and resolve the authenticated User's `_id`, `Department`, and `Position` from MongoDB before processing the request; IF MongoDB is unreachable, THEN THE Vault API SHALL return HTTP 503; IF the user record is not found, THEN THE Vault API SHALL return HTTP 401.
2. IF the `session` cookie is absent, expired, or malformed, THEN THE Vault API SHALL return HTTP 401 and SHALL NOT return or modify any Vault_Entry data.
3. WHEN a User retrieves the Vault_Entry list, THE Vault API SHALL return only entries where the `department` column matches the User's `Department` (case-sensitive exact match) OR the `allowed_roles` JSONB array contains the User's `Position` (case-sensitive exact match).
4. WHEN a User submits a create request without specifying a `department`, THE Vault API SHALL default the entry's `department` to the authenticated User's `Department`.
5. WHEN a User submits a create, update, or delete request for a Vault_Entry, THE Vault API SHALL verify the User's `Position` is in `['IT Admin', 'IT Manager', 'Super Admin']` OR the Vault_Entry's `department` matches the User's `Department`; IF the User fails both authorization checks, THEN THE Vault API SHALL return HTTP 403 and SHALL NOT modify the Vault_Entry.
6. THE Vault API SHALL record the authenticated User's `_id` and full name in the `created_by` or `updated_by` field on every create or update operation.

---

### Requirement 3: Vault Entry CRUD Operations

**User Story:** As an IT administrator, I want to create, view, edit, and delete credential entries with structured metadata, so that my team has a single organized source of truth for service credentials.

#### Acceptance Criteria

1. WHEN a User submits a create request, THE Vault API SHALL validate the request body against the Vault_Entry Zod_Schema requiring `service_name` (non-empty string, max 255 characters) and `password` (non-empty string) and allowing optional `login_url`, `username` (max 255 characters), `notes` (max 2000 characters), `department`, `tags` (array, max 20 items), `is_favorite`, `review_date`, and `allowed_roles`.
2. IF the Zod_Schema validation fails, THEN THE Vault API SHALL return HTTP 400 with a structured error object listing each failing field name and its error message, and SHALL NOT write to the database.
3. WHEN a valid create request is processed, THE Vault API SHALL encrypt the plaintext password via the Encryptor, compute and store the Password_Strength_Analyzer rating in the `password_strength` column, set `is_active` to `true`, and insert the record into `credential_vault` with `created_by` set to the authenticated User's identifier.
4. WHEN a User submits an update request for a Vault_Entry, THE Vault API SHALL validate the partial update body against a variant of the Vault_Entry Zod_Schema where all fields are optional; IF a new plaintext password is provided, THEN THE Vault API SHALL re-encrypt it via the Encryptor and update both `password_encrypted`, `iv`, and `password_strength`; IF no new plaintext password is provided, THEN THE Vault API SHALL leave `password_encrypted`, `iv`, and `password_strength` unchanged.
5. WHEN a User submits a delete request for a Vault_Entry, THE Vault API SHALL set `is_active` to `false` (soft delete) and SHALL NOT physically remove the row from `credential_vault`.
6. WHEN a User retrieves the Vault_Entry list, THE Vault API SHALL return only entries where `is_active` is `true`, excluding the `password_encrypted` and `iv` columns from the response payload.
7. WHEN a User submits a successful update request, THE Vault API SHALL update the `updated_at` timestamp to the current UTC time and set `updated_by` to the authenticated User's identifier.

---

### Requirement 4: Password Reveal and Copy Controls

**User Story:** As an authorized user, I want to reveal or copy a credential password on demand, so that I can access the plaintext only when I explicitly need it, keeping it masked by default.

#### Acceptance Criteria

1. THE Vault UI SHALL display all credential passwords as masked (`••••••••`) by default without making any decryption API call on initial page load.
2. WHEN a User clicks the reveal button for a Vault_Entry, THE Vault UI SHALL call the reveal API endpoint with the entry `id`, and THE Vault API SHALL decrypt and return the plaintext password in the JSON response body.
3. WHEN a User clicks the copy button for a Vault_Entry, THE Vault UI SHALL call the copy API endpoint; THE Vault API SHALL decrypt the password and return it in the JSON response body; THE Vault UI SHALL then write the returned plaintext to the clipboard via the browser Clipboard API without rendering the plaintext in the DOM.
4. WHEN the reveal or copy API endpoint is called, THE Vault API SHALL write an Audit_Log entry with `action` set to `'reveal'` or `'copy'` respectively, including the authenticated User's identifier, IP address, and UTC timestamp.
5. WHEN a User reveals a password, THE Vault UI SHALL start a 30-second countdown; WHEN the countdown reaches zero, THE Vault UI SHALL re-mask the password without requiring user interaction; WHEN the User clicks reveal again while a countdown is active, THE Vault UI SHALL reset the countdown to 30 seconds.
6. IF the Vault API returns an error for a reveal or copy request, THEN THE Vault UI SHALL display a Sonner toast error notification and preserve the masked state for that entry.
7. IF the Vault API cannot decrypt a Vault_Entry due to a decryption error, THEN THE Vault API SHALL return HTTP 500 and SHALL NOT return partial ciphertext or the IV in the error response.

---

### Requirement 5: Auto-Lock on Inactivity

**User Story:** As a security administrator, I want the vault to auto-lock after 15 minutes of user inactivity, so that unattended browser sessions cannot expose credentials.

#### Acceptance Criteria

1. WHILE the Vault page is open, THE Auto_Lock SHALL track the elapsed time since the last user interaction (mouse move, keypress, click, or scroll event) using a client-side timer.
2. WHEN 15 minutes have elapsed without a qualifying interaction, THE Auto_Lock SHALL mask all currently revealed passwords and display a lock-screen overlay requiring the User to re-enter their account password before the Vault UI resumes normal operation.
3. WHEN the User generates a qualifying interaction (mouse move, keypress, click, or scroll event) on the Vault page, THE Auto_Lock timer SHALL reset to zero.
4. WHEN the lock-screen overlay is displayed, THE Vault UI SHALL NOT make any new decrypt API calls until the User successfully re-enters their account password and the lock screen is dismissed.
5. WHEN 13 minutes have elapsed without a qualifying interaction, THE Vault UI SHALL display a visible countdown warning showing the seconds remaining until lock; WHILE the countdown is visible, THE Vault UI SHALL update it every second until the lock triggers or the User resets the timer.
6. IF the User enters an incorrect password on the lock screen three consecutive times, THEN THE Vault UI SHALL redirect to the login page and invalidate the current vault session.

---

### Requirement 6: Real-Time Search and Filtering

**User Story:** As a user, I want to search and filter credentials by name, department, tag, and expiry, so that I can quickly locate specific entries without scrolling through the full list.

#### Acceptance Criteria

1. THE Vault UI SHALL provide a text search input that filters the displayed Vault_Entry list in real-time (client-side) by `service_name`, `username`, `login_url`, and `notes` fields using case-insensitive substring matching.
2. THE Vault UI SHALL provide a dropdown filter for `department` (showing "All Departments" or a specific Department value) and a multi-select filter for `tags` populated from tag values present in the currently loaded Vault_Entry list.
3. THE Vault UI SHALL provide an expiry filter that shows entries with a `review_date` on or before N days from the current date (including past review dates with no lower bound), where N is selectable as 7, 30, or 90; entries where `review_date` is null SHALL be excluded from expiry filter results.
4. WHILE a User has marked a Vault_Entry as favorite (`is_favorite = true`), THE Vault UI SHALL display those entries in a dedicated "Favorites" section at the top of the list; active search and filter criteria SHALL apply within the Favorites section as well as the main list.
5. WHEN a User changes a search term or filter value, THE Vault UI SHALL update the filtered list within 100ms without triggering a new API request.
6. WHEN no entries match the active filters, THE Vault UI SHALL display an empty state message rather than an error.
7. WHEN multiple filters are active simultaneously (text search, department, tags, expiry), THE Vault UI SHALL apply all active filters with AND logic, showing only entries that satisfy every active filter condition.

---

### Requirement 7: Password Strength Analysis

**User Story:** As an IT administrator, I want each stored credential to have a computed strength rating, so that I can prioritize updating weak passwords.

#### Acceptance Criteria

1. WHEN a Vault_Entry is created or updated with a new password, THE Password_Strength_Analyzer SHALL evaluate the plaintext password and assign the highest tier whose both conditions are satisfied, using these rules in descending priority: `strong` (16+ characters AND all four character classes: uppercase letter, lowercase letter, digit, special character); `good` (12–15 characters AND at least three of the four character classes); `fair` (8–11 characters AND at least two of the four character classes); `weak` (any password not meeting a higher tier's conditions, including fewer than 8 characters or only one character class); if no higher tier is matched, the rating defaults to `weak`.
2. THE Password_Strength_Analyzer SHALL store the computed rating in the `password_strength` column of the `credential_vault` table; IF the database write of the `password_strength` value fails, THEN THE Vault API SHALL return HTTP 500 and SHALL NOT persist the Vault_Entry.
3. THE Vault UI SHALL display the strength rating alongside each Vault_Entry in the list using a colour-coded badge: red for `weak`, amber for `fair`, green for `good`, cyan for `strong`, and grey labelled "Unrated" for `null` values (entries predating the analyzer).
4. WHEN a User types in the password field of the add/edit form, THE Vault UI SHALL update the real-time strength meter within 100ms of each keystroke using the same rating logic as the server-side Password_Strength_Analyzer applied client-side.

---

### Requirement 8: Reused Password Detection

**User Story:** As an IT administrator, I want to be alerted when the same password is used across multiple credential entries, so that I can enforce password uniqueness across services.

#### Acceptance Criteria

1. WHEN a Vault_Entry is created or updated with a new password, THE Reuse_Detector SHALL compute an HMAC-SHA256 hash of the plaintext password using a server-side secret (`VAULT_HMAC_SECRET` environment variable) and compare it against the hashes of all other active Vault_Entries scoped to the same `referenceid`.
2. IF the Reuse_Detector finds one or more matching hashes, THEN THE Vault API SHALL include a `reuse_warning` field in the response body listing the `service_name` values of all conflicting entries, and SHALL still save the Vault_Entry; IF the hash computation or comparison fails due to a system error, THEN THE Vault API SHALL NOT include a `reuse_warning` field in the response.
3. THE Vault UI SHALL display the `reuse_warning` as a Sonner toast notification listing the conflicting service names, without blocking the save operation.
4. THE Health_Dashboard SHALL display the total count of active Vault_Entries (scoped to the authenticated User's `referenceid`) flagged as having a reused password.

---

### Requirement 9: Security Health Dashboard

**User Story:** As an IT manager, I want a health overview of all stored credentials, so that I can quickly assess the overall security posture and take corrective action.

#### Acceptance Criteria

1. THE Health_Dashboard SHALL display the total count of active Vault_Entries scoped to the authenticated User's `referenceid`, and separate counts for entries with `password_strength` of `weak`, `fair`, `good`, and `strong`.
2. THE Health_Dashboard SHALL display the count of active Vault_Entries scoped to the authenticated User's `referenceid` whose `review_date` is earlier than the current UTC date (expired credentials).
3. THE Health_Dashboard SHALL display the count of active Vault_Entries scoped to the authenticated User's `referenceid` detected as having a reused password by the Reuse_Detector.
4. WHEN a User clicks a health metric count, THE Vault UI SHALL apply the corresponding filter to the Vault_Entry list: clicking a strength count shows entries matching that `password_strength` value; clicking the expired count shows entries where `review_date` is earlier than the current UTC date; clicking the reused count shows entries flagged as having a reused password.
5. THE Health_Dashboard data SHALL be computed server-side from the `credential_vault` table and cached in Redis_Cache with a 5-minute TTL keyed by `referenceid`; IF Redis_Cache is unavailable, THEN THE Vault API SHALL fall back to a live database query and SHALL NOT return an error to the client.

---

### Requirement 10: Expiry Reminder Notifications

**User Story:** As an IT administrator, I want to receive alerts when credentials are approaching their review date, so that I can proactively rotate them before they become a security risk.

#### Acceptance Criteria

1. WHEN the Vault page loads, THE Vault UI SHALL call the reminders API and display a Sonner toast notification (duration: 10 seconds) for each Vault_Entry whose `review_date` is between tomorrow and 30 calendar days from the current UTC date (inclusive) and whose `is_active` is `true`; entries with a `review_date` on or before the current UTC date SHALL NOT trigger a toast notification.
2. IF the reminders API call fails on page load, THEN THE Vault UI SHALL display a single Sonner toast error notification indicating that reminder data could not be loaded, without blocking access to the Vault.
3. WHEN the reminders API endpoint is called, THE Vault API SHALL send at most one email per Vault_Entry per milestone day via Resend to the email address of the user identified by `created_by`, for each active Vault_Entry whose `review_date` is exactly 30, 14, or 7 calendar days from the current UTC date.
4. THE Vault UI SHALL display a badge on the Vault sidebar menu item showing the count of active Vault_Entries whose `review_date` is between tomorrow and 30 calendar days from the current UTC date (inclusive); entries with a `review_date` on or before the current UTC date SHALL NOT be included in this count.
5. IF a Vault_Entry has no `review_date`, THEN THE Vault API reminder endpoint SHALL skip that entry without generating a notification or email.

---

### Requirement 11: Full Audit Logging

**User Story:** As a security administrator, I want every vault interaction to be logged with user identity, action, IP address, and timestamp, so that I have a complete chain of custody for all credential accesses.

#### Acceptance Criteria

1. WHEN any of the following events occurs, THE Vault API SHALL write an Audit_Log entry to `vault_audit_logs` before returning the response: `view` (Vault_Entry list for a vault is loaded), `reveal` (password decrypted for display), `copy` (password decrypted for clipboard), `add` (new entry created), `edit` (entry updated), `delete` (entry soft-deleted).
2. THE Audit_Log entry SHALL contain: `credential_id` (NULL for `view` actions; the BIGINT id of the affected entry otherwise), `user_id` (authenticated User's MongoDB `_id`), `user_name` (User's full name at time of action), `action` (one of the six action values), `ip_address` (first value from `x-forwarded-for` header if present, otherwise `req.socket.remoteAddress`; stored as `"unknown"` if both sources are absent), and `timestamp` (UTC timestamp at time of action).
3. WHEN a User expands the detail panel for a Vault_Entry, THE Vault UI SHALL display a paginated Audit_Log table showing the 50 most recent audit entries for that entry ordered by `timestamp` descending.
4. WHEN the Audit_Log table is rendered and no audit entries exist for the Vault_Entry, THE Vault UI SHALL display the message "No audit activity recorded for this entry." in place of the table rows.
5. IF writing an Audit_Log entry fails, THEN THE Vault API SHALL log the error to the server console but SHALL NOT block or roll back the primary vault operation that triggered the audit.

---

### Requirement 12: Import from JSON and CSV

**User Story:** As an IT administrator, I want to import credentials from a JSON or CSV file, so that I can migrate existing credential stores into the Vault without manual data entry.

#### Acceptance Criteria

1. THE Vault UI SHALL accept file uploads of at most 500 rows in `.json` and `.csv` format via a dedicated import dialog; IF the uploaded file contains more than 500 rows, THEN THE Vault API SHALL return HTTP 400 with an error message stating the row limit and SHALL NOT process the file.
2. WHEN a file is uploaded, THE Vault API SHALL parse the file before validation; IF the file is malformed (invalid JSON syntax, structurally invalid CSV, or unrecognized format), THEN THE Vault API SHALL return HTTP 400 with an error message identifying the parse failure and SHALL NOT attempt row validation.
3. IF any parsed row fails Vault_Entry Zod_Schema validation, THEN THE Vault API SHALL return HTTP 400 with a list of objects each containing `rowIndex` (0-based) and `errors` (field-level error messages), and SHALL NOT insert any records from the import batch (atomic import).
4. WHEN all rows pass validation, THE Vault API SHALL encrypt each password via the Encryptor, set `created_by` to the authenticated User's identifier for all rows, and insert all records in a single database transaction; IF the transaction fails, THEN THE Vault API SHALL return HTTP 500 and roll back all inserts.
5. THE Vault UI SHALL display a preview table of the parsed rows before the User confirms the import, showing all fields except the plaintext password (displayed as `••••••••`).
6. WHEN the import succeeds, THE Vault API SHALL write a single Audit_Log entry with `action` set to `'import'` and a `notes` field containing the text `"Imported {N} entries"` where `{N}` is the count of inserted records.
7. WHEN parsing a CSV file, THE Vault API SHALL treat the first row as a header row mapping column names to Vault_Entry field names; required header columns are `service_name` and `password`; IF either required header is absent, THEN THE Vault API SHALL return HTTP 400 with an error listing the missing headers.

---

### Requirement 13: Export as Encrypted JSON

**User Story:** As an IT administrator, I want to export credentials as an encrypted JSON file, so that I can create backups without exposing plaintext passwords.

#### Acceptance Criteria

1. THE Vault UI SHALL provide an export button that triggers a confirmation dialog warning the User that the exported file contains sensitive encrypted data before proceeding.
2. WHEN the User confirms the export, THE Vault API SHALL retrieve all active Vault_Entries scoped to the User's `referenceid` and serialize them as a JSON array where each object includes the fields: `service_name`, `username`, `login_url`, `notes`, `department`, `tags`, `review_date`, `password_encrypted`, and `iv`; the response SHALL NOT include any decrypted plaintext password.
3. WHEN the export request is processed, THE Vault API SHALL set the response `Content-Disposition` header to `attachment; filename="vault-export-{YYYY-MM-DD}.json"` using the current UTC date.
4. WHEN the export request is processed, THE Vault API SHALL write an Audit_Log entry with `action` set to `'export'`, `credential_id` set to NULL, and all other fields populated per Requirement 11 criterion 2.
5. WHEN the export download completes, THE Vault UI SHALL display a Sonner toast warning (duration: 10 seconds) reminding the User that the file contains sensitive data and must be stored securely.
6. WHEN an export request is received, THE Vault API SHALL verify the User's `Position` is in `['IT Admin', 'IT Manager', 'Super Admin']`; IF the User's `Position` is not in that list, THEN THE Vault API SHALL return HTTP 403 and SHALL NOT generate the export file.
7. IF the database query or JSON serialization fails during export, THEN THE Vault API SHALL return HTTP 500 and SHALL NOT deliver a partial file to the client.

---

### Requirement 14: Security Headers and Input Sanitization

**User Story:** As a security administrator, I want all Vault API routes to enforce strict HTTP security headers and sanitize inputs, so that the module is protected against common web vulnerabilities.

#### Acceptance Criteria

1. THE Vault API SHALL include the following HTTP response headers on every response: `Content-Security-Policy: default-src 'self'`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=63072000; includeSubDomains`, and `X-XSS-Protection: 1; mode=block`.
2. WHEN a Vault API request body is received, THE Vault API SHALL apply Zod_Schema validation in strict mode (rejecting unexpected fields) before executing any business logic.
3. THE Vault API SHALL trim leading and trailing whitespace from all string input fields before storing them to the database.
4. THE Vault API SHALL enforce a maximum request body size of 1 MB for all Vault routes; IF the request body exceeds 1 MB, THEN THE Vault API SHALL return HTTP 413 with an error message indicating the size limit and SHALL NOT process the request.
5. IF any string input field contains a null byte (`\u0000`), THEN THE Vault API SHALL return HTTP 400 with an error message identifying the offending field and SHALL NOT store the value to the database.

---

### Requirement 15: Sidebar Integration and Navigation

**User Story:** As a Stash user, I want to find the Credential Vault under the Asset Management sidebar group, so that I can access it without leaving the familiar Stash navigation structure.

#### Acceptance Criteria

1. THE Vault UI SHALL be accessible at the route `/asset/credential-vault` within the Next.js app router.
2. IF a User accesses `/asset/credential-vault` without a valid session cookie, THEN THE Vault UI SHALL redirect the User to the login page.
3. IF the Vault page is loaded without the `id` query parameter, THEN THE Vault UI SHALL redirect the User to the login page.
4. THE SidebarLeft component SHALL include a "Credential Vault" menu item with a `KeySquare` Lucide icon under the "Asset Management" workspace group, positioned after the existing "Platform Plans" item.
5. THE Vault UI SHALL use the same dark theme styling as other Stash pages: `#080c10` page background, `#0d1117` sidebar background, `rgba(255,255,255,0.07)` border color, and the `font-mono` class throughout.
6. THE Vault UI SHALL render the same `SidebarLeft`, `SidebarRight`, `SidebarProvider`, `SidebarInset`, `SidebarTrigger`, breadcrumb, and header layout structure used by all other Stash asset pages.
7. WHEN the Vault page is loaded, THE Vault UI SHALL read the `id` value from the URL query parameter and append it as `?id={value}` to all internal navigation links and API requests made from that page.
