#!/usr/bin/env tsx
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { cronActor, insertAuditEventSupabase } from "~/lib/audit";
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

interface UserCleanup {
  userId: string;
  removedBookmarks: number;
  removedWorkspaces: number;
}

/**
 * Record the privileged run: one run-level event plus one event per user
 * whose data was hard-deleted (docs/policies/data-access.md §5.3). Counts
 * only — the events never carry bookmark URLs or titles.
 */
async function recordRun(options: {
  success: boolean;
  removedBookmarks: number;
  removedWorkspaces: number;
  perUser: UserCleanup[];
  errorCount: number;
}): Promise<void> {
  await insertAuditEventSupabase(supabase, {
    actorType: "cron",
    actorId: cronActor("cleanup-trash"),
    action: "trash_cleanup.run",
    resourceType: "trash",
    reason:
      "Scheduled hard-delete of trashed items past each user's cleanup interval",
    metadata: {
      success: options.success,
      removedBookmarks: options.removedBookmarks,
      removedWorkspaces: options.removedWorkspaces,
      affectedUsers: options.perUser.length,
      errorCount: options.errorCount,
    },
  });

  for (const user of options.perUser) {
    await insertAuditEventSupabase(supabase, {
      actorType: "cron",
      actorId: cronActor("cleanup-trash"),
      action: "trash_cleanup.hard_delete_user",
      resourceType: "trash",
      resourceId: user.userId,
      reason:
        "Scheduled hard-delete of trashed items past the user's cleanup interval",
      metadata: {
        removedBookmarks: user.removedBookmarks,
        removedWorkspaces: user.removedWorkspaces,
      },
    });
  }
}

async function cleanupTrash(): Promise<{
  success: boolean;
  removedBookmarks: number;
  removedWorkspaces: number;
  perUser: UserCleanup[];
  errors: string[];
}> {
  let removedBookmarks = 0;
  let removedWorkspaces = 0;
  const errors: string[] = [];
  const perUser = new Map<string, UserCleanup>();

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
      perUser: [],
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
      perUser: [],
      errors: [profilesParsed.error.message],
    };
  }

  if (profilesParsed.data.length === 0) {
    logger.info("No users with auto-cleanup enabled");
    return {
      success: true,
      removedBookmarks: 0,
      removedWorkspaces: 0,
      perUser: [],
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

    let userRemovedBookmarks = 0;
    if (bmError) {
      logger.error("Error deleting expired bookmarks", {
        userId: profile.id,
        error: bmError,
      });
      errors.push(bmError.message);
    } else {
      userRemovedBookmarks = deletedBms?.length ?? 0;
      removedBookmarks += userRemovedBookmarks;
    }

    // Hard-delete expired trashed workspaces (bookmarks cascade or already deleted above)
    const { data: deletedWs, error: wsError } = await supabase
      .from("workspaces")
      .delete()
      .eq("user_id", profile.id)
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff.toISOString())
      .select("id");

    let userRemovedWorkspaces = 0;
    if (wsError) {
      logger.error("Error deleting expired workspaces", {
        userId: profile.id,
        error: wsError,
      });
      errors.push(wsError.message);
    } else {
      userRemovedWorkspaces = deletedWs?.length ?? 0;
      removedWorkspaces += userRemovedWorkspaces;
    }

    if (userRemovedBookmarks > 0 || userRemovedWorkspaces > 0) {
      perUser.set(profile.id, {
        userId: profile.id,
        removedBookmarks: userRemovedBookmarks,
        removedWorkspaces: userRemovedWorkspaces,
      });
    }
  }

  logger.info("Trash cleanup completed", {
    removedBookmarks,
    removedWorkspaces,
  });
  return {
    success: true,
    removedBookmarks,
    removedWorkspaces,
    perUser: [...perUser.values()],
    errors,
  };
}

if (require.main === module) {
  cleanupTrash()
    .then(async (result) => {
      logger.info("Trash cleanup result", {
        success: result.success,
        removedBookmarks: result.removedBookmarks,
        removedWorkspaces: result.removedWorkspaces,
        errorCount: result.errors.length,
      });
      // Privileged cross-user run: documented in docs/policies/data-access.md §5.
      // Audit failure must fail the run — a privileged run that cannot be
      // audited is a failed run (§5.4), so this happens before process.exit.
      try {
        await recordRun({
          success: result.success,
          removedBookmarks: result.removedBookmarks,
          removedWorkspaces: result.removedWorkspaces,
          perUser: result.perUser,
          errorCount: result.errors.length,
        });
      } catch (err) {
        logger.error("Audit event recording failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        process.exit(1);
      }
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      logger.error("Fatal error", {
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    });
}
