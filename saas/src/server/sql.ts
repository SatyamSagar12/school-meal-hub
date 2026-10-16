import "server-only";

/**
 * Helpers for the few raw D1 statements (atomic batches).
 *
 * Prisma's D1 adapter writes DateTime as ISO-8601 with "+00:00" rather than
 * "Z"; raw writes use the same form so Prisma reads them back unchanged.
 */
export function sqlDate(date = new Date()): string {
  return date.toISOString().replace("Z", "+00:00");
}

/** Row ids for raw inserts. Prisma's cuid() default only applies to Prisma writes. */
export function newId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}
