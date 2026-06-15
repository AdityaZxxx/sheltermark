import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { ActionResult } from "~/lib/action-result";
import { fetchMetadata } from "~/lib/metadata";
import type { Bookmark } from "~/lib/schemas/bookmark.schema";
import {
  type BookmarkDeleteInput,
  type BookmarkMoveInput,
  type BookmarkRefetchMetadataInput,
  type BookmarkRenameInput,
  type BookmarkRestoreInput,
  bookmarkDeleteSchema,
  bookmarkMoveSchema,
  bookmarkRefetchMetadataSchema,
  bookmarkRenameSchema,
  bookmarkRestoreSchema,
} from "~/lib/schemas/bookmark.schema";
import type { exportOptionsSchema } from "~/lib/schemas/profile.schema";
import { normalizeUrl } from "~/lib/utils";

type InsertBookmarkParams = {
  url: string;
  workspaceId?: string | null;
  clientTitle?: string | null;
};

type InsertBookmarkResult =
  | { success: true; data: Bookmark }
  | { success: false; duplicate: true }
  | { success: false; duplicate?: false; error: string };

export async function insertBookmark(
  supabase: SupabaseClient,
  userId: string,
  { url, workspaceId, clientTitle }: InsertBookmarkParams,
): Promise<InsertBookmarkResult> {
  const normalizedUrl = normalizeUrl(url);

  let existingQuery = supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", userId)
    .eq("url", normalizedUrl);

  if (workspaceId) {
    existingQuery = existingQuery.eq("workspace_id", workspaceId);
  } else {
    existingQuery = existingQuery.is("workspace_id", null);
  }

  const [existing, metadata] = await Promise.all([
    existingQuery.maybeSingle(),
    fetchMetadata(url),
  ]);

  if (existing.data) {
    return { success: false, duplicate: true };
  }

  const title = metadata?.title ?? clientTitle ?? "Untitled";

  const { data, error } = await supabase
    .from("bookmarks")
    .insert([
      {
        user_id: userId,
        url: normalizedUrl,
        workspace_id: workspaceId || null,
        title,
        favicon_url: metadata?.favicon_url ?? null,
        og_image_url: metadata?.og_image_url ?? null,
      },
    ])
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function getBookmarks(
  supabase: SupabaseClient,
  userId: string,
  workspaceId?: string,
): Promise<ActionResult<Bookmark[]>> {
  let query = supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  }

  const { data: bookmarks, error } = await query;

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (bookmarks as Bookmark[]) ?? [] };
}

export async function deleteBookmarks(
  supabase: SupabaseClient,
  userId: string,
  { ids }: BookmarkDeleteInput,
): Promise<ActionResult<null>> {
  const validated = bookmarkDeleteSchema.safeParse({ ids });
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { error } = await supabase
    .from("bookmarks")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in("id", validated.data.ids)
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function getTrashedBookmarks(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActionResult<Bookmark[]>> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data as Bookmark[]) ?? [] };
}

export async function restoreBookmarks(
  supabase: SupabaseClient,
  userId: string,
  input: BookmarkRestoreInput,
): Promise<ActionResult<null>> {
  const validated = bookmarkRestoreSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { ids, targetWorkspaceId, newWorkspaceName } = validated.data;

  let resolvedWorkspaceId: string | null | undefined = targetWorkspaceId;

  if (newWorkspaceName) {
    const { createWorkspaceRaw } = await import(
      "~/lib/data/repositories/workspace.repository"
    );
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

  const updateData: Record<string, unknown> = {
    deleted_at: null,
    updated_at: now,
  };

  if (resolvedWorkspaceId !== undefined) {
    updateData.workspace_id = resolvedWorkspaceId;
  }

  const { error } = await supabase
    .from("bookmarks")
    .update(updateData)
    .in("id", ids)
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function permanentDeleteBookmarks(
  supabase: SupabaseClient,
  userId: string,
  { ids }: BookmarkDeleteInput,
): Promise<ActionResult<null>> {
  const validated = bookmarkDeleteSchema.safeParse({ ids });
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .in("id", validated.data.ids)
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function emptyTrashBookmarks(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActionResult<null>> {
  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .not("deleted_at", "is", null)
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function moveBookmarks(
  supabase: SupabaseClient,
  userId: string,
  { ids, targetWorkspaceId }: BookmarkMoveInput,
): Promise<ActionResult<{ movedCount: number; skippedCount: number }>> {
  const validated = bookmarkMoveSchema.safeParse({ ids, targetWorkspaceId });
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const sourceIds = validated.data.ids;
  const targetId =
    !validated.data.targetWorkspaceId ||
    validated.data.targetWorkspaceId === "null"
      ? null
      : validated.data.targetWorkspaceId;

  // 1. Get the URLs of the bookmarks to be moved
  const { data: sourceBookmarks, error: fetchError } = await supabase
    .from("bookmarks")
    .select("id, url")
    .in("id", sourceIds)
    .eq("user_id", userId);

  if (fetchError) return { success: false, error: fetchError.message };
  if (!sourceBookmarks || sourceBookmarks.length === 0)
    return { success: false, error: "No bookmarks found to move" };

  const sourceUrls = sourceBookmarks.map((b) => b.url);

  // 2. Check for existing (non-trashed) URLs in the target workspace
  let existingQuery = supabase
    .from("bookmarks")
    .select("url")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("url", sourceUrls);

  if (targetId) {
    existingQuery = existingQuery.eq("workspace_id", targetId);
  } else {
    existingQuery = existingQuery.is("workspace_id", null);
  }

  const { data: existingInTarget, error: checkError } = await existingQuery;
  if (checkError) return { success: false, error: checkError.message };

  const existingUrls = new Set(existingInTarget?.map((b) => b.url) ?? []);

  // 3. Separate IDs into those to move and those to skip
  const toMoveIds: string[] = [];
  let skippedCount = 0;
  for (const bookmark of sourceBookmarks) {
    if (existingUrls.has(bookmark.url)) {
      skippedCount++;
    } else {
      toMoveIds.push(bookmark.id);
    }
  }

  // 4. Perform the move for non-duplicates
  if (toMoveIds.length > 0) {
    const { error: moveError } = await supabase
      .from("bookmarks")
      .update({ workspace_id: targetId, updated_at: new Date().toISOString() })
      .in("id", toMoveIds)
      .eq("user_id", userId);
    if (moveError) return { success: false, error: moveError.message };
  }

  return {
    success: true,
    data: {
      movedCount: toMoveIds.length,
      skippedCount,
    },
  };
}

export async function renameBookmark(
  supabase: SupabaseClient,
  userId: string,
  { id, title }: BookmarkRenameInput,
): Promise<ActionResult<null>> {
  const validated = bookmarkRenameSchema.safeParse({ id, title });
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { error } = await supabase
    .from("bookmarks")
    .update({
      title: validated.data.title,
      updated_at: new Date().toISOString(),
    })
    .eq("id", validated.data.id)
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function refetchMetadata(
  supabase: SupabaseClient,
  userId: string,
  id: BookmarkRefetchMetadataInput,
): Promise<ActionResult<null>> {
  const validated = bookmarkRefetchMetadataSchema.safeParse(id);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { data: bookmark, error: fetchError } = await supabase
    .from("bookmarks")
    .select("id, url, favicon_url, og_image_url")
    .eq("id", validated.data.id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !bookmark) {
    return { success: false, error: "Bookmark not found" };
  }

  const metadata = await fetchMetadata(bookmark.url);

  const { error: updateError } = await supabase
    .from("bookmarks")
    .update({
      favicon_url: metadata?.favicon_url ?? null,
      og_image_url: metadata?.og_image_url ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", validated.data.id)
    .eq("user_id", userId);

  if (updateError) return { success: false, error: updateError.message };

  return { success: true, data: null };
}

// ----------------- Export bookmarks (query only) -----------------
// This function queries Supabase for bookmarks along with their associated
// workspaces. It returns raw data which will be formatted by the action layer.
type BookmarkWithWorkspace = {
  id: string;
  url: string;
  title: string | null;
  favicon_url: string | null;
  og_image_url: string | null;
  created_at: string;
  workspace_id: string | null;
  workspaces: { id: number; name: string }[] | null;
};

export async function exportBookmarks(
  supabase: SupabaseClient,
  userId: string,
  options: z.infer<typeof exportOptionsSchema>,
): Promise<ActionResult<BookmarkWithWorkspace[]>> {
  // Build base query to fetch bookmarks with their workspace information
  let query = supabase
    .from("bookmarks")
    .select(`
      id,
      url,
      title,
      favicon_url,
      og_image_url,
      created_at,
      workspace_id,
      workspaces!inner(id, name)
    `)
    .eq("user_id", userId)
    .is("deleted_at", null);

  // Optional workspace filter
  if (options.workspaceId) {
    query = query.eq("workspace_id", options.workspaceId);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  const bookmarksData = (data ?? []) as BookmarkWithWorkspace[];
  return { success: true, data: bookmarksData };
}
