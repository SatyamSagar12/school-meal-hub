import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Small crypto helpers. node:crypto runs on Workers under `nodejs_compat`;
 * password hashing (auth/password.ts) uses WebCrypto instead.
 */

/** 32 random bytes, URL-safe. For session cookies and emailed links. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** What is stored in place of a token: a keyed hash, useless without the secret. */
export function hmac(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant-time string comparison. Unequal lengths are simply unequal. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
