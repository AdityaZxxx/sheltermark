"use server";

import { requireAuth } from "~/lib/auth";
import { insertBookmark } from "~/lib/bookmark";
import { fetchMetadata } from "~/lib/metadata";
import {
  type Bookmark,
  type BookmarkCreateInput,
  type BookmarkDeleteInput,
  type BookmarkMoveInput,
  type BookmarkRefetchMetadataInput,
  type BookmarkRenameInput,
  bookmarkCreateSchema,
  bookmarkDeleteSchema,
  bookmarkMoveSchema,
  bookmarkRefetchMetadataSchema,
  bookmarkRenameSchema,
} from "~/lib/schemas/bookmark";

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

type AddBookmarkResult = ActionResult<Bookmark>;
type DeleteBookmarksResult = ActionResult<null>;
type MoveBookmarksResult = ActionResult<{
  movedCount: number;
  skippedCount: number;
}>;
type RenameBookmarkResult = ActionResult<null>;
type RefetchMetadataResult = ActionResult<null>;
type GetBookmarksResult = ActionResult<Bookmark[]>;

export async function addBookmark(
  data: BookmarkCreateInput,
): Promise<AddBookmarkResult> {
  const validated = bookmarkCreateSchema.safeParse(data);

  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { user, supabase } = await requireAuth();

  const result = await insertBookmark(supabase, user.id, data);

  if (!result.success) {
    return {
      success: false,
      error: result.duplicate
        ? "Bookmark already exists in this workspace"
        : result.error,
    };
  }

  return { success: true, data: result.data };
}

export async function deleteBookmarks({
  ids,
}: BookmarkDeleteInput): Promise<DeleteBookmarksResult> {
  const validated = bookmarkDeleteSchema.safeParse({ ids });

  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .in("id", validated.data.ids)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  return { success: true, data: null };
}

export async function moveBookmarks({
  ids,
  targetWorkspaceId,
}: BookmarkMoveInput): Promise<MoveBookmarksResult> {
  const validated = bookmarkMoveSchema.safeParse({ ids, targetWorkspaceId });

  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { user, supabase } = await requireAuth();
  const targetId =
    !targetWorkspaceId || targetWorkspaceId === "null"
      ? null
      : validated.data.targetWorkspaceId;

  // 1. Get the URLs of the bookmarks to be moved
  const { data: sourceBookmarks, error: fetchError } = await supabase
    .from("bookmarks")
    .select("id, url")
    .in("id", validated.data.ids)
    .eq("user_id", user.id);

  if (fetchError) return { success: false, error: fetchError.message };
  if (!sourceBookmarks || sourceBookmarks.length === 0)
    return { success: false, error: "No bookmarks found to move" };

  const sourceUrls = sourceBookmarks.map((b) => b.url);

  // 2. Check for existing URLs in the target workspace
  let existingQuery = supabase
    .from("bookmarks")
    .select("url")
    .eq("user_id", user.id)
    .in("url", sourceUrls);

  if (targetId) {
    existingQuery = existingQuery.eq("workspace_id", targetId);
  } else {
    existingQuery = existingQuery.is("workspace_id", null);
  }

  const { data: existingInTarget, error: checkError } = await existingQuery;

  if (checkError) return { success: false, error: checkError.message };

  const existingUrls = new Set(existingInTarget?.map((b) => b.url) || []);

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
      .eq("user_id", user.id);

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

export async function renameBookmark({
  id,
  title,
}: BookmarkRenameInput): Promise<RenameBookmarkResult> {
  const validated = bookmarkRenameSchema.safeParse({ id, title });

  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("bookmarks")
    .update({
      title: validated.data.title,
      updated_at: new Date().toISOString(),
    })
    .eq("id", validated.data.id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  return { success: true, data: null };
}

export async function refetchBookmarkMetadata(
  id: BookmarkRefetchMetadataInput,
): Promise<RefetchMetadataResult> {
  const validated = bookmarkRefetchMetadataSchema.safeParse(id);

  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { user, supabase } = await requireAuth();

  const { data: bookmark, error: fetchError } = await supabase
    .from("bookmarks")
    .select("id, url, favicon_url, og_image_url")
    .eq("id", validated.data.id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !bookmark)
    return { success: false, error: "Bookmark not found" };

  const metadata = await fetchMetadata(bookmark.url);

  const { error: updateError } = await supabase
    .from("bookmarks")
    .update({
      favicon_url: metadata.favicon_url,
      og_image_url: metadata.og_image_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", validated.data.id)
    .eq("user_id", user.id);

  if (updateError) return { success: false, error: updateError.message };

  return { success: true, data: null };
}

export async function getBookmarks(
  workspaceId?: string,
): Promise<GetBookmarksResult> {
  const { user, supabase } = await requireAuth();

  let query = supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Filter by workspace if provided
  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  }

  const { data, error } = await query;

  if (error) return { success: false, error: error.message };

  return { success: true, data: data ?? [] };
}
