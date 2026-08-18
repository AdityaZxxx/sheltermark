#!/usr/bin/env tsx
import { createDb } from "~/lib/data/drizzle-instance";
import { syncAllFeedsGlobal } from "~/lib/data/repositories/feed.repository";
import { logger } from "~/lib/logger";

if (!process.env.DATABASE_URL) {
  logger.error("Missing required env var: DATABASE_URL");
  process.exit(1);
}

const db = createDb();

export async function syncFeeds(): Promise<{
  success: boolean;
  synced: number;
  errors: string[];
}> {
  const result = await syncAllFeedsGlobal(db);

  if (!result.success) {
    logger.error("Feed sync failed", { error: result.error });
    return { success: false, synced: 0, errors: [result.error] };
  }

  logger.info(`Feed sync completed: ${result.data.synced} feeds synced`);
  return {
    success: true,
    synced: result.data.synced,
    errors: result.data.errors,
  };
}

if (require.main === module) {
  syncFeeds().then((result) => {
    logger.info("Feed sync result", {
      success: result.success,
      synced: result.synced,
      errorCount: result.errors.length,
    });
    process.exit(result.success ? 0 : 1);
  });
}
