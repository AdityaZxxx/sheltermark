#!/usr/bin/env tsx
import { createClient } from "@supabase/supabase-js";

import { syncAllFeedsGlobal } from "~/lib/data/repositories/feed.repository";
import { logger } from "~/lib/logger";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  logger.error(
    "Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function syncFeeds(): Promise<{
  success: boolean;
  synced: number;
  errors: string[];
}> {
  const result = await syncAllFeedsGlobal(supabase);

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
