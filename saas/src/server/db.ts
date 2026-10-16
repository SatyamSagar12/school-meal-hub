import "server-only";
import { cache } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * One Prisma client per request, bound to that request's D1 binding.
 *
 * A Worker must not hold I/O objects across requests, so there is no
 * module-level singleton as there would be on Node. `cache` dedupes within
 * a single render or action.
 *
 * D1 has no interactive transactions: Prisma runs `$transaction` as separate
 * statements. Writes that must be all-or-nothing use `d1()` and
 * `D1Database.batch`, which D1 does run atomically.
 */
export const db = cache((): PrismaClient => new PrismaClient({ adapter: new PrismaD1(d1()) }));

export function d1(): D1Database {
  return getCloudflareContext().env.DB;
}
