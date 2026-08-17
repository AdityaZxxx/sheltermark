#!/usr/bin/env tsx
import { createClient } from "@supabase/supabase-js";

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

async function cleanupTrash(): Promise<{
  success: boolean;
  removedBookmarks: number;
  removedWorkspaces: number;
  errors: string[];
}> {
  let removedBookmarks = 0;
  let removedWorkspaces = 0;
  const errors: string[] = [];

  // Get all users with auto-cleanup enabled
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, trash_cleanup_interval")
    .not("trash_cleanup_interval", "is", null);

  if (profilesError) {
    logger.error("Error fetching profiles", { error: profilesError });
    return {
      success: false,
      removedBookmarks: 0,
      removedWorkspaces: 0,
      errors: [profilesError.message],
    };
  }

  if (!profiles || profiles.length === 0) {
    logger.info("No users with auto-cleanup enabled");
    return {
      success: true,
      removedBookmarks: 0,
      removedWorkspaces: 0,
      errors: [],
    };
  }

  logger.info(`Found ${profiles.length} users with auto-cleanup enabled`);

  for (const profile of profiles) {
    // SAFETY: the query above applies .not("trash_cleanup_interval", "is", null),
    // so every returned row carries the interval; a null here would be a
    // PostgREST contract violation.
    const interval = profile.trash_cleanup_interval as number;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - interval);

    logger.info(
      `Cleaning trash for user ${profile.id} (interval: ${interval}d, cutoff: ${cutoff.toISOString()})`,
    );

    // Hard-delete expired trashed bookmarks
    const { data: deletedBms, error: bmError } = await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", profile.id)
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff.toISOString())
      .select("id");

    if (bmError) {
      logger.error("Error deleting expired bookmarks", {
        userId: profile.id,
        error: bmError,
      });
      errors.push(bmError.message);
    } else {
      removedBookmarks += deletedBms?.length ?? 0;
    }

    // Hard-delete expired trashed workspaces (bookmarks cascade or already deleted above)
    const { data: deletedWs, error: wsError } = await supabase
      .from("workspaces")
      .delete()
      .eq("user_id", profile.id)
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff.toISOString())
      .select("id");

    if (wsError) {
      logger.error("Error deleting expired workspaces", {
        userId: profile.id,
        error: wsError,
      });
      errors.push(wsError.message);
    } else {
      removedWorkspaces += deletedWs?.length ?? 0;
    }
  }

  logger.info("Trash cleanup completed", {
    removedBookmarks,
    removedWorkspaces,
  });
  return { success: true, removedBookmarks, removedWorkspaces, errors };
}

// Run if executed directly
if (require.main === module) {
  cleanupTrash().then((result) => {
    logger.info("Trash cleanup result", {
      success: result.success,
      removedBookmarks: result.removedBookmarks,
      removedWorkspaces: result.removedWorkspaces,
      errorCount: result.errors.length,
    });
    process.exit(result.success ? 0 : 1);
  });
}
