import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for drizzle-kit");
}

/**
 * Migration generation setup (see docs/setup.md "Database Migrations").
 *
 * drizzle-kit generate diffs lib/data/schema.ts against the journal in
 * supabase/migrations/meta/ and writes the next .sql migration. files use
 * the "supabase" prefix so the Supabase CLI applies them in version order.
 *
 * drizzle-kit only models tables, columns, indexes, and CHECK constraints.
 * RLS policies, triggers, and plpgsql functions are NOT expressible in the
 * schema DSL and must be spliced into the generated file by hand (see the
 * audit_events helper in 20260820..._add_audit_events.sql for precedent).
 * Migrations are applied with `supabase db push` — drizzle-kit migrate is
 * NOT used (it would open a second tracker table besides supabase_migrations).
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/data/schema.ts",
  out: "./supabase/migrations",
  migrations: { prefix: "supabase" },
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
