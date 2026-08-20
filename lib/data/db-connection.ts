import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "~/lib/data/schema";

export type DrizzleDb = PostgresJsDatabase<typeof schema>;

/**
 * SECURITY: connects with the pooled service-role credential, which BYPASSES
 * ROW LEVEL SECURITY. Every repository query must enforce `user_id` ownership
 * explicitly — RLS will not save us here.
 *
 * Transaction-mode pooler (port 6543), so `prepare: false`: server-side
 * prepared statements are incompatible with transaction pooling.
 *
 * Kept free of `server-only` so non-Next entrypoints (cron scripts) can build
 * an instance directly. App code must use `getDb()` in lib/data/db.ts.
 */
export function createDb(): DrizzleDb {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing DATABASE_URL for Drizzle");
  }
  const client = postgres(url, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => {},
  });
  return drizzle(client, { schema });
}
