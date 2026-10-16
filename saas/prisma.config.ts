import { defineConfig } from "prisma/config";

/**
 * Prisma here only generates the client and diffs migrations. The database
 * is D1, reached through its binding at runtime; migrations are applied by
 * wrangler (see package.json).
 *
 * The datasource is a throwaway SQLite file that scripts/new-migration.mjs
 * rebuilds from /migrations before every diff. Nothing reads it at runtime.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env["MIGRATE_SCRATCH_URL"] ?? "file:./.migrate-scratch.db",
  },
});
