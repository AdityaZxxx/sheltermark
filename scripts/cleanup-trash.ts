#!/usr/bin/env tsx
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { logger } from "~/lib/logger";
import { uuidSchema } from "~/lib/schemas/common";

const cleanupProfileSchema = z.object({
  id: uuidSchema,
  trash_cleanup_interval: z.number().int().positive(),
});

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

  const profilesParsed = z
    .array(cleanupProfileSchema)
    .safeParse(profiles ?? []);
  if (!profilesParsed.success) {
    logger.error("Unexpected profile shape in cleanup query", {
      message: profilesParsed.error.message,
    });
    return {
      success: false,
      removedBookmarks: 0,
      removedWorkspaces: 0,
      errors: [profilesParsed.error.message],
    };
  }

  if (profilesParsed.data.length === 0) {
    logger.info("No users with auto-cleanup enabled");
    return {
      success: true,
      removedBookmarks: 0,
      removedWorkspaces: 0,
      errors: [],
    };
  }

  logger.info(
    `Found ${profilesParsed.data.length} users with auto-cleanup enabled`,
  );

  for (const profile of profilesParsed.data) {
    const interval = profile.trash_cleanup_interval;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - interval);

    logger.info(
      `Cleaning trash for user ${profile.id} (interval: ${interval}d, cutoff: ${cutoff.toISOString()})`,
    );

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
