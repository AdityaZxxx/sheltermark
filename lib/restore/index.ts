import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionResult } from "~/lib/action-result";
import { createWorkspaceRaw } from "~/lib/data/repositories/workspace.repository";
import type {
  Bookmark,
  BookmarkRestoreInput,
} from "~/lib/schemas/bookmark.schema";
import { bookmarkRestoreSchema } from "~/lib/schemas/bookmark.schema";
import type {
  TrashedWorkspace,
  WorkspaceWithCount,
} from "~/lib/schemas/workspace.schema";

export type RestoreTarget = {
  ids: string[];
  hasTrashedOrigin: boolean;
  trashedWorkspaceName: string | null;
  trashedWorkspaceId: string | null;
  originalWorkspaceName: string | null;
};

export function getRestoreTargetForUI(
  ids: string[],
  trashedBookmarks: Bookmark[],
  trashedWorkspaces: TrashedWorkspace[],
  activeWorkspaces: WorkspaceWithCount[],
): RestoreTarget {
  const trashedBookmarkIdsFromWs = new Set(
    trashedWorkspaces.flatMap((ws) => ws.bookmarks.map((bm) => bm.id)),
  );

  const trashedBookmarkToWs = new Map<string, { id: string; name: string }>();
  for (const ws of trashedWorkspaces) {
    for (const bm of ws.bookmarks) {
      trashedBookmarkToWs.set(bm.id, { id: ws.id, name: ws.name });
    }
  }

  const hasTrashedOrigin = ids.some((id) => trashedBookmarkIdsFromWs.has(id));

  let trashedWorkspaceName: string | null = null;
  let trashedWorkspaceId: string | null = null;

  if (hasTrashedOrigin) {
    for (const id of ids) {
      const ws = trashedBookmarkToWs.get(id);
      if (ws) {
        trashedWorkspaceName = ws.name;
        trashedWorkspaceId = ws.id;
        break;
      }
    }
  }

  let originalWorkspaceName: string | null = null;
  if (!hasTrashedOrigin && ids.length > 0) {
    const bm = trashedBookmarks.find((b) => b.id === ids[0]);
    if (bm?.workspace_id) {
      const ws = activeWorkspaces.find((w) => w.id === bm.workspace_id);
      if (ws) originalWorkspaceName = ws.name;
    }
  }

  return {
    ids,
    hasTrashedOrigin,
    trashedWorkspaceName,
    trashedWorkspaceId,
    originalWorkspaceName,
  };
}

export async function restoreBookmarks(
  supabase: SupabaseClient,
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
    const result = await createWorkspaceRaw(supabase, userId, newWorkspaceName);
    if (!result.success) return result;
    resolvedWorkspaceId = result.data.id;
  }

  const now = new Date().toISOString();

  if (resolvedWorkspaceId === undefined) {
    const { data: bookmarks } = await supabase
      .from("bookmarks")
      .select("id, workspace_id")
      .in("id", ids)
      .eq("user_id", userId);

    const wsIds = [
      ...new Set(
        (bookmarks ?? [])
          .filter((b) => b.workspace_id)
          .map((b) => b.workspace_id as string),
      ),
    ];

    if (wsIds.length > 0) {
      const { data: trashed } = await supabase
        .from("workspaces")
        .select("id")
        .in("id", wsIds)
        .not("deleted_at", "is", null);

      if (trashed && trashed.length > 0) {
        return {
          success: false,
          error:
            "Cannot restore bookmarks to a trashed workspace. Restore the workspace first, or choose a different destination.",
        };
      }
    }
  }

  const { data: toRestore } = await supabase
    .from("bookmarks")
    .select("id, url, workspace_id")
    .in("id", ids)
    .eq("user_id", userId);

  if (!toRestore || toRestore.length === 0) {
    return { success: false, error: "No bookmarks found to restore" };
  }

  const restoreGroups = new Map<
    string | null,
    { ids: string[]; urls: string[] }
  >();
  for (const bm of toRestore) {
    const wsKey = bm.workspace_id ?? null;
    const group = restoreGroups.get(wsKey) ?? { ids: [], urls: [] };
    group.ids.push(bm.id);
    group.urls.push(bm.url);
    restoreGroups.set(wsKey, group);
  }

  const existingMap = new Map<string | null, Set<string>>();
  for (const [wsKey, { urls }] of restoreGroups) {
    let query = supabase
      .from("bookmarks")
      .select("url")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .in("url", urls);

    if (wsKey !== null) {
      query = query.eq("workspace_id", wsKey);
    } else {
      query = query.is("workspace_id", null);
    }

    const { data: existing } = await query;
    existingMap.set(wsKey, new Set(existing?.map((b) => b.url) ?? []));
  }

  const toRestoreIds: string[] = [];
  let skippedCount = 0;
  for (const bm of toRestore) {
    const wsKey = bm.workspace_id ?? null;
    const existingUrls = existingMap.get(wsKey) ?? new Set();
    if (existingUrls.has(bm.url)) {
      skippedCount++;
    } else {
      toRestoreIds.push(bm.id);
    }
  }

  const updateData: Record<string, unknown> = {
    deleted_at: null,
    updated_at: now,
  };

  if (resolvedWorkspaceId !== undefined) {
    updateData.workspace_id = resolvedWorkspaceId;
  }

  if (toRestoreIds.length > 0) {
    const { error } = await supabase
      .from("bookmarks")
      .update(updateData)
      .in("id", toRestoreIds)
      .eq("user_id", userId);

    if (error) return { success: false, error: error.message };
  }

  return {
    success: true,
    data: {
      restoredCount: toRestoreIds.length,
      skippedCount,
    },
  };
}

export async function restoreWorkspace(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<ActionResult<{ restoredCount: number; skippedCount: number }>> {
  const now = new Date().toISOString();

  const { error: wsError } = await supabase
    .from("workspaces")
    .update({ deleted_at: null })
    .eq("id", id)
    .eq("user_id", userId);

  if (wsError) return { success: false, error: wsError.message };

  const { data: trashedBookmarks } = await supabase
    .from("bookmarks")
    .select("id, url")
    .eq("workspace_id", id)
    .eq("user_id", userId)
    .not("deleted_at", "is", null);

  if (!trashedBookmarks || trashedBookmarks.length === 0) {
    return { success: true, data: { restoredCount: 0, skippedCount: 0 } };
  }

  const urls = trashedBookmarks.map((b) => b.url);

  const { data: existing } = await supabase
    .from("bookmarks")
    .select("url")
    .eq("user_id", userId)
    .eq("workspace_id", id)
    .is("deleted_at", null)
    .in("url", urls);

  const existingUrls = new Set(existing?.map((b) => b.url) ?? []);

  const toRestoreIds: string[] = [];
  let skippedCount = 0;

  for (const bm of trashedBookmarks) {
    if (existingUrls.has(bm.url)) {
      skippedCount++;
    } else {
      toRestoreIds.push(bm.id);
    }
  }

  if (toRestoreIds.length > 0) {
    const { error: bmError } = await supabase
      .from("bookmarks")
      .update({ deleted_at: null, updated_at: now })
      .in("id", toRestoreIds)
      .eq("user_id", userId);

    if (bmError) return { success: false, error: bmError.message };
  }

  return {
    success: true,
    data: { restoredCount: toRestoreIds.length, skippedCount },
  };
}
