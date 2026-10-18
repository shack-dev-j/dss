import crypto from "crypto";
import { env } from "@/lib/env";

/**
 * Generates a random, non-identifying public receipt code.
 * Example format: NPS-7K9W2B4X
 */
export function generateReceiptCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Base32 unambiguous set
  let code = "NPS-";
  const randomBytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return code;
}

/**
 * Generates a cryptographically strong, high-entropy secret token (64 hex characters).
 * This token is given to the student once and never stored directly in the database.
 */
export function generateSecretToken(): string {
  return "sec_" + crypto.randomBytes(32).toString("hex");
}

/**
 * Computes a secure SHA-256 verifier hash of the secret token combined with pepper.
 */
export function hashSecretToken(token: string): string {
  return crypto
    .createHash("sha256")
    .update(`${token}:${env.anonymousPepper()}`)
    .digest("hex");
}

/**
 * Validates whether a provided secret token matches the stored secret verifier hash.
 * Uses timing-safe equal comparison to prevent timing attacks.
 */
export function verifySecretToken(providedToken: string, storedHash: string): boolean {
  if (!providedToken || !storedHash) return false;
  const computedHash = hashSecretToken(providedToken);
  try {
    const computedBuffer = Buffer.from(computedHash, "hex");
    const storedBuffer = Buffer.from(storedHash, "hex");
    if (computedBuffer.length !== storedBuffer.length) return false;
    return crypto.timingSafeEqual(computedBuffer, storedBuffer);
  } catch {
    return false;
  }
}
