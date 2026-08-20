#!/usr/bin/env tsx
import type { DrizzleDb } from "~/lib/data/drizzle-instance";

import { cronActor, insertAuditEvent } from "~/lib/audit";
import { createDb } from "~/lib/data/drizzle-instance";
import { syncAllFeedsGlobal } from "~/lib/data/repositories/feed.repository";
import { logger } from "~/lib/logger";

if (!process.env.DATABASE_URL) {
  logger.error("Missing required env var: DATABASE_URL");
  process.exit(1);
}

const db = createDb();

async function recordRun(
  database: DrizzleDb,
  outcome: { success: boolean; synced: number; errorCount: number },
): Promise<void> {
  // Privileged cross-user run: documented in docs/policies/data-access.md §5.
  await insertAuditEvent(database, {
    actorType: "cron",
    actorId: cronActor("sync-feeds"),
    action: "feed_sync.run",
    resourceType: "feed",
    reason: "Scheduled RSS/Atom sync across all users' feeds",
    metadata: {
      success: outcome.success,
      synced: outcome.synced,
      errorCount: outcome.errorCount,
    },
  });
}

export async function syncFeeds(): Promise<{
  success: boolean;
  synced: number;
  errors: string[];
}> {
  const result = await syncAllFeedsGlobal(db);

  if (!result.success) {
    logger.error("Feed sync failed", { error: result.error });
    await recordRun(db, { success: false, synced: 0, errorCount: 1 });
    return { success: false, synced: 0, errors: [result.error] };
  }

  logger.info(`Feed sync completed: ${result.data.synced} feeds synced`);
  await recordRun(db, {
    success: true,
    synced: result.data.synced,
    errorCount: result.data.errors.length,
  });
  return {
    success: true,
    synced: result.data.synced,
    errors: result.data.errors,
  };
}

if (require.main === module) {
  syncFeeds()
    .then((result) => {
      logger.info("Feed sync result", {
        success: result.success,
        synced: result.synced,
        errorCount: result.errors.length,
      });
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      // Covers audit-write failures too: a privileged run that cannot be
      // audited is a failed run (docs/policies/data-access.md §5.4).
      logger.error("Fatal error", {
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    });
}
