/**
 * lib/vault-strength.ts
 * Password strength analyzer for the Credential Vault.
 * Used server-side (API routes) and mirrored client-side (components).
 */

export type PasswordStrength = "weak" | "fair" | "good" | "strong";

/**
 * Returns the character-class count for a given password:
 * uppercase, lowercase, digit, special character.
 */
function countCharClasses(password: string): number {
  let count = 0;
  if (/[A-Z]/.test(password)) count++;
  if (/[a-z]/.test(password)) count++;
  if (/[0-9]/.test(password)) count++;
  if (/[^A-Za-z0-9]/.test(password)) count++;
  return count;
}

/**
 * Rates a plaintext password strength.
 *
 * Rules (highest tier wins):
 *   strong : len >= 16 AND all 4 char classes
 *   good   : len 12–15 AND >= 3 char classes
 *   fair   : len 8–11  AND >= 2 char classes
 *   weak   : everything else (< 8 chars or only 1 class)
 */
export function analyzeStrength(password: string): PasswordStrength {
  if (!password) return "weak";

  const len = password.length;
  const classes = countCharClasses(password);

  if (len >= 16 && classes >= 4) return "strong";
  if (len >= 12 && len <= 15 && classes >= 3) return "good";
  if (len >= 8 && len <= 11 && classes >= 2) return "fair";
  return "weak";
}

export const STRENGTH_CONFIG: Record<
  PasswordStrength,
  { label: string; color: string; bg: string; border: string; bar: string; width: string }
> = {
  weak: {
    label: "Weak",
    color: "#f87171",
    bg: "rgba(248,113,113,0.1)",
    border: "rgba(248,113,113,0.3)",
    bar: "#f87171",
    width: "25%",
  },
  fair: {
    label: "Fair",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.1)",
    border: "rgba(251,191,36,0.3)",
    bar: "#fbbf24",
    width: "50%",
  },
  good: {
    label: "Good",
    color: "#4ade80",
    bg: "rgba(74,222,128,0.1)",
    border: "rgba(74,222,128,0.3)",
    bar: "#4ade80",
    width: "75%",
  },
  strong: {
    label: "Strong",
    color: "#22d3ee",
    bg: "rgba(34,211,238,0.1)",
    border: "rgba(34,211,238,0.3)",
    bar: "#22d3ee",
    width: "100%",
  },
};
