import "server-only";
import { d1 } from "@/server/db";
import { sha256Hex } from "@/server/crypto";

/**
 * Fixed-window rate limiter, shared through D1 — the same design as
 * Docchase's Postgres one. Workers run as many isolates at once, so a limit
 * kept in memory would be per isolate and mean nothing.
 *
 * Each check is ONE statement (insert-or-update-returning), so two parallel
 * attempts can never both read "9 of 10" and both pass. D1 serialises
 * writes, which is what makes that hold.
 *
 * Keys are hashed before storage: they contain emails and IP addresses.
 */

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = Date.now();
  const row = await d1()
    .prepare(
      `INSERT INTO rate_limits ("key", "count", "resetAtMs") VALUES (?1, 1, ?2 + ?3)
       ON CONFLICT ("key") DO UPDATE SET
         "count" = CASE WHEN rate_limits."resetAtMs" <= ?2 THEN 1 ELSE rate_limits."count" + 1 END,
         "resetAtMs" = CASE WHEN rate_limits."resetAtMs" <= ?2 THEN ?2 + ?3 ELSE rate_limits."resetAtMs" END
       RETURNING "count", "resetAtMs"`,
    )
    .bind(sha256Hex(key), now, windowMs)
    .first<{ count: number; resetAtMs: number }>();

  const count = row?.count ?? 1;
  const allowed = count <= limit;
  return {
    allowed,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil(((row?.resetAtMs ?? now) - now) / 1000)),
  };
}

/**
 * Counts a guess BEFORE it is checked; false once the limit is used up.
 * Call `resetRateLimit` on success.
 */
export async function claimAttempt(key: string, limit: number, windowMs: number): Promise<boolean> {
  return (await rateLimit(key, limit, windowMs)).allowed;
}

export async function resetRateLimit(key: string): Promise<void> {
  await d1().prepare(`DELETE FROM rate_limits WHERE "key" = ?1`).bind(sha256Hex(key)).run();
}

/** Housekeeping: drops windows that have ended. */
export async function pruneRateLimits(): Promise<void> {
  await d1().prepare(`DELETE FROM rate_limits WHERE "resetAtMs" <= ?1`).bind(Date.now()).run();
}
