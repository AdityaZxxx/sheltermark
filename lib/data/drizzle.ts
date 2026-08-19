import "server-only";
import type { DrizzleDb } from "~/lib/data/drizzle-instance";

import { createDb } from "~/lib/data/drizzle-instance";

export type { DrizzleDb } from "~/lib/data/drizzle-instance";

/**
 * Server-only cached Drizzle instance for app request paths. Cron scripts
 * call `createDb()` from lib/data/drizzle-instance.ts directly because they
 * run outside Next.js's react-server condition.
 */
let cachedDb: DrizzleDb | null = null;

export function getDb(): DrizzleDb {
  if (!cachedDb) {
    cachedDb = createDb();
  }
  return cachedDb;
}
