import "server-only";
import type { DrizzleDb } from "~/lib/data/db-connection";

import { createDb } from "~/lib/data/db-connection";

export type { DrizzleDb } from "~/lib/data/db-connection";

/**
 * Server-only cached Drizzle instance for app request paths. Cron scripts
 * call `createDb()` from lib/data/db-connection.ts directly because they
 * run outside Next.js's react-server condition.
 */
let cachedDb: DrizzleDb | null = null;

export function getDb(): DrizzleDb {
  if (!cachedDb) {
    cachedDb = createDb();
  }
  return cachedDb;
}
