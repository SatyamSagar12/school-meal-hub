#!/usr/bin/env node
/**
 * Writes the next D1 migration: the SQL that takes a database built from
 * every file in /migrations to prisma/schema.prisma.
 *
 *   npm run db:migration add_holidays
 *
 * It replays the existing migrations into a throwaway SQLite file to get the
 * "from" side, so it never needs a live database. Review the file, then
 * `npm run db:migrate:local` and, when deploying, `db:migrate:remote`.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const name = (process.argv[2] ?? "").replace(/[^a-z0-9_]/gi, "_").toLowerCase();
if (!name) {
  console.error("Usage: npm run db:migration <name>");
  process.exit(1);
}

const dir = "migrations";
const existing = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const scratch = join(mkdtempSync(join(tmpdir(), "mdm-mig-")), "from.db");
const db = new DatabaseSync(scratch);
for (const file of existing) db.exec(readFileSync(join(dir, file), "utf8"));
db.close();

const sql = execFileSync(
  "npx",
  [
    "prisma", "migrate", "diff",
    ...(existing.length ? ["--from-config-datasource"] : ["--from-empty"]),
    "--to-schema", "prisma/schema.prisma",
    "--script",
  ],
  { encoding: "utf8", env: { ...process.env, MIGRATE_SCRATCH_URL: `file:${scratch}` } },
);

if (!sql.trim() || /^-- This is an empty migration/m.test(sql)) {
  console.log("Schema and migrations already match. Nothing written.");
  process.exit(0);
}

const next = String(existing.length + 1).padStart(4, "0");
const file = join(dir, `${next}_${name}.sql`);
writeFileSync(file, sql);
console.log(`Wrote ${file}`);
