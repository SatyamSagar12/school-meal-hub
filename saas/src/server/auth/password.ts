import "server-only";
import { randomBytes } from "node:crypto";
import { safeEqual } from "@/server/crypto";

/**
 * Password hashing with PBKDF2-SHA256 through WebCrypto.
 *
 * Docchase uses argon2id, but that is a native module and a Worker cannot
 * load one. PBKDF2 is the strongest KDF WebCrypto offers, and 100,000
 * iterations is the most a Worker allows (higher counts are refused).
 * The stored string carries its own parameters, so the count can be raised
 * later and old hashes still verify.
 *
 *   pbkdf2-sha256$<iterations>$<salt b64>$<hash b64>
 */

const ITERATIONS = 100_000;
const KEY_BITS = 256;

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2-sha256$${ITERATIONS}$${Buffer.from(salt).toString("base64")}$${Buffer.from(hash).toString("base64")}`;
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  const [scheme, iter, saltB64, hashB64] = stored.split("$");
  const iterations = Number(iter);
  if (scheme !== "pbkdf2-sha256" || !Number.isInteger(iterations) || iterations < 1 || !saltB64 || !hashB64) {
    return false;
  }
  const hash = await derive(password, Buffer.from(saltB64, "base64"), iterations);
  return safeEqual(Buffer.from(hash).toString("base64"), hashB64);
}

/**
 * Burns the same time as a real check, so "no such account" and "wrong
 * password" cannot be told apart by how long sign-in takes.
 */
export async function dummyVerify(password: string): Promise<void> {
  await derive(password, new Uint8Array(16), ITERATIONS);
}

/** Readable, unambiguous, 12 characters: for an admin to hand to a teacher. */
export function generateTemporaryPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
