/**
 * lib/vault-crypto.ts
 * AES-256-CBC encryption/decryption for the Credential Vault.
 * Master key is read exclusively from VAULT_MASTER_KEY env var.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16; // 16 bytes for AES-CBC

let masterKeyBuffer: Buffer | null = null;
let keyInitError: string | null = null;

function getMasterKey(): Buffer {
  if (masterKeyBuffer) return masterKeyBuffer;
  if (keyInitError) throw new Error(keyInitError);

  const raw = process.env.VAULT_MASTER_KEY;
  if (!raw || raw.trim() === "") {
    keyInitError = "VAULT_MASTER_KEY environment variable is missing or empty.";
    throw new Error(keyInitError);
  }

  // Key must be exactly 64 hex characters = 32 bytes
  const hex = raw.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    keyInitError =
      "VAULT_MASTER_KEY must be exactly 64 hex characters (32 bytes). " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"";
    throw new Error(keyInitError);
  }

  masterKeyBuffer = Buffer.from(hex, "hex");
  return masterKeyBuffer;
}

export interface EncryptResult {
  encrypted: string; // base64 ciphertext
  iv: string;        // base64 IV
}

/**
 * Encrypts a plaintext string using AES-256-CBC.
 * Generates a unique random IV per call.
 */
export function encrypt(plaintext: string): EncryptResult {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    encrypted: enc.toString("base64"),
    iv: iv.toString("base64"),
  };
}

/**
 * Decrypts a base64 ciphertext with a base64 IV using AES-256-CBC.
 */
export function decrypt(encryptedBase64: string, ivBase64: string): string {
  const key = getMasterKey();
  const iv = Buffer.from(ivBase64, "base64");
  const encrypted = Buffer.from(encryptedBase64, "base64");

  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid IV length — expected 16 bytes.");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const dec = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return dec.toString("utf8");
}

/**
 * Computes an HMAC-SHA256 of a value using VAULT_HMAC_SECRET.
 * Used for reuse detection without storing plaintext hashes.
 */
export function hmacHash(value: string): string {
  const secret = process.env.VAULT_HMAC_SECRET;
  if (!secret) throw new Error("VAULT_HMAC_SECRET environment variable is missing.");
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

/**
 * Returns true if the master key env var is present and valid.
 */
export function isMasterKeyConfigured(): boolean {
  try {
    getMasterKey();
    return true;
  } catch {
    return false;
  }
}
