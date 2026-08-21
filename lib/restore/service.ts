import "server-only";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import type { ActionResult } from "~/lib/action-result";
import type { DrizzleDb } from "~/lib/data/db";
import type { BookmarkRestoreInput } from "~/lib/schemas/bookmark.schema";

import { createWorkspaceRaw } from "~/lib/data/repositories/workspace.repository";
import { bookmarks, workspaces } from "~/lib/data/schema";
import { bookmarkRestoreSchema } from "~/lib/schemas/bookmark.schema";

export async function restoreBookmarks(
  db: DrizzleDb,
  userId: string,
  input: BookmarkRestoreInput,
): Promise<ActionResult<{ restoredCount: number; skippedCount: number }>> {
  const validated = bookmarkRestoreSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { ids, targetWorkspaceId, newWorkspaceName } = validated.data;

  let resolvedWorkspaceId: string | null | undefined = targetWorkspaceId;

  if (newWorkspaceName) {
    const result = await createWorkspaceRaw(db, userId, newWorkspaceName);
    if (!result.success) return result;
    resolvedWorkspaceId = result.data.id;
  }

  const now = new Date();

  if (resolvedWorkspaceId === undefined) {
    const rows = await db
      .select({ id: bookmarks.id, workspaceId: bookmarks.workspace_id })
      .from(bookmarks)
      .where(and(inArray(bookmarks.id, ids), eq(bookmarks.user_id, userId)));

    const wsIds = [
      ...new Set(
        rows
          .map((b) => b.workspaceId)
          .filter((id): id is string => id !== null),
      ),
    ];

    if (wsIds.length > 0) {
      const trashed = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(
          and(inArray(workspaces.id, wsIds), isNotNull(workspaces.deletedAt)),
        );

      if (trashed.length > 0) {
        return {
          success: false,
          error:
            "Cannot restore bookmarks to a trashed workspace. Restore the workspace first, or choose a different destination.",
        };
      }
    }
  }

  const toRestore = await db
    .select({
      id: bookmarks.id,
      url: bookmarks.url,
      workspaceId: bookmarks.workspace_id,
    })
    .from(bookmarks)
    .where(and(inArray(bookmarks.id, ids), eq(bookmarks.user_id, userId)));

  if (toRestore.length === 0) {
    return { success: false, error: "No bookmarks found to restore" };
  }

  const restoreGroups = new Map<
    string | null,
    { ids: string[]; urls: string[] }
  >();
  for (const bm of toRestore) {
    const wsKey = bm.workspaceId ?? null;
    const group = restoreGroups.get(wsKey) ?? { ids: [], urls: [] };
    group.ids.push(bm.id);
    group.urls.push(bm.url);
    restoreGroups.set(wsKey, group);
  }

  const duplicateIds = new Set<string>();
  for (const [wsKey, { urls }] of restoreGroups) {
    if (urls.length === 0) continue;
    if (wsKey !== null) {
      const existing = await db
        .select({ url: bookmarks.url })
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.user_id, userId),
            isNull(bookmarks.deleted_at),
            eq(bookmarks.workspace_id, wsKey),
            inArray(bookmarks.url, urls),
          ),
        );
      const existingUrls = new Set(existing.map((b) => b.url));
      for (const bm of toRestore) {
        if (bm.workspaceId === wsKey && existingUrls.has(bm.url)) {
          duplicateIds.add(bm.id);
        }
      }
    } else {
      const existing = await db
        .select({ url: bookmarks.url })
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.user_id, userId),
            isNull(bookmarks.deleted_at),
            isNull(bookmarks.workspace_id),
            inArray(bookmarks.url, urls),
          ),
        );
      const existingUrls = new Set(existing.map((b) => b.url));
      for (const bm of toRestore) {
        if (bm.workspaceId === null && existingUrls.has(bm.url)) {
          duplicateIds.add(bm.id);
        }
      }
    }
  }

  const toRestoreIds = toRestore
    .map((bm) => bm.id)
    .filter((id) => !duplicateIds.has(id));

  if (toRestoreIds.length > 0) {
    const patch: Partial<typeof bookmarks.$inferInsert> = {
      deleted_at: null,
      updated_at: now.toISOString(),
    };
    if (resolvedWorkspaceId !== undefined) {
      patch.workspace_id = resolvedWorkspaceId;
    }

    try {
      await db
        .update(bookmarks)
        .set(patch)
        .where(
          and(
            inArray(bookmarks.id, toRestoreIds),
            eq(bookmarks.user_id, userId),
          ),
        );
    } catch (cause) {
      return {
        success: false,
        error: cause instanceof Error ? cause.message : "Database error",
      };
    }
  }

  return {
    success: true,
    data: {
      restoredCount: toRestoreIds.length,
      skippedCount: duplicateIds.size,
    },
  };
}

export async function restoreWorkspace(
  db: DrizzleDb,
  userId: string,
  id: string,
): Promise<ActionResult<{ restoredCount: number; skippedCount: number }>> {
  const now = new Date();

  try {
    await db
      .update(workspaces)
      .set({ deletedAt: null })
      .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)));
  } catch (cause) {
    return {
      success: false,
      error: cause instanceof Error ? cause.message : "Database error",
    };
  }

  const trashedRows = await db
    .select({ id: bookmarks.id, url: bookmarks.url })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.workspace_id, id),
        eq(bookmarks.user_id, userId),
        isNotNull(bookmarks.deleted_at),
      ),
    );

  if (trashedRows.length === 0) {
    return { success: true, data: { restoredCount: 0, skippedCount: 0 } };
  }

  const urls = trashedRows.map((b) => b.url);

  const existing = await db
    .select({ url: bookmarks.url })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.user_id, userId),
        eq(bookmarks.workspace_id, id),
        isNull(bookmarks.deleted_at),
        inArray(bookmarks.url, urls),
      ),
    );

  const existingUrls = new Set(existing.map((b) => b.url));

  const toRestoreIds: string[] = [];
  let skippedCount = 0;

  for (const bm of trashedRows) {
    if (existingUrls.has(bm.url)) {
      skippedCount++;
    } else {
      toRestoreIds.push(bm.id);
    }
  }

  if (toRestoreIds.length > 0) {
    try {
      await db
        .update(bookmarks)
        .set({ deleted_at: null, updated_at: now.toISOString() })
        .where(
          and(
            inArray(bookmarks.id, toRestoreIds),
            eq(bookmarks.user_id, userId),
          ),
        );
    } catch (cause) {
      return {
        success: false,
        error: cause instanceof Error ? cause.message : "Database error",
      };
    }
  }

  return {
    success: true,
    data: { restoredCount: toRestoreIds.length, skippedCount },
  };
}
