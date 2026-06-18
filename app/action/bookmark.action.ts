"use server";

import type { ActionResult } from "~/lib/action-result";
import { requireAuth } from "~/lib/auth";
import {
  deleteBookmarks as deleteBookmarksRepo,
  getBookmarks as getBookmarksRepo,
  insertBookmark as insertBookmarkRepo,
  moveBookmarks as moveBookmarksRepo,
  refetchMetadata as refetchMetadataRepo,
  renameBookmark as renameBookmarkRepo,
  updateBookmarkFields as updateBookmarkFieldsRepo,
  updateBookmarkNote as updateBookmarkNoteRepo,
} from "~/lib/data/repositories/bookmark.repository";
import type {
  Bookmark,
  BookmarkCreateInput,
  BookmarkDeleteInput,
  BookmarkEditInput,
  BookmarkMoveInput,
  BookmarkRefetchMetadataInput,
  BookmarkRenameInput,
  BookmarkUpdateNoteInput,
} from "~/lib/schemas/bookmark.schema";
import type { Tag } from "~/lib/schemas/tag.schema";

export async function addBookmark(
  data: BookmarkCreateInput,
): Promise<ActionResult<Bookmark>> {
  const { user, supabase } = await requireAuth();
  const result = await insertBookmarkRepo(supabase, user.id, data);
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
}: BookmarkDeleteInput): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();
  return deleteBookmarksRepo(supabase, user.id, { ids });
}

export async function moveBookmarks({
  ids,
  targetWorkspaceId,
}: BookmarkMoveInput): Promise<
  ActionResult<{ movedCount: number; skippedCount: number }>
> {
  const { user, supabase } = await requireAuth();
  return moveBookmarksRepo(supabase, user.id, { ids, targetWorkspaceId });
}

export async function renameBookmark({
  id,
  title,
}: BookmarkRenameInput): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();
  return renameBookmarkRepo(supabase, user.id, { id, title });
}

export async function updateBookmarkNote({
  id,
  note,
}: BookmarkUpdateNoteInput): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();
  return updateBookmarkNoteRepo(supabase, user.id, { id, note });
}

export async function refetchBookmarkMetadata(
  id: BookmarkRefetchMetadataInput,
): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();
  return refetchMetadataRepo(supabase, user.id, id);
}

export async function getBookmarks(
  workspaceId?: string,
): Promise<ActionResult<Bookmark[]>> {
  const { user, supabase } = await requireAuth();
  return getBookmarksRepo(supabase, user.id, workspaceId);
}

export async function updateBookmarkFields(
  input: BookmarkEditInput,
): Promise<ActionResult<Tag[]>> {
  const { user, supabase } = await requireAuth();
  return updateBookmarkFieldsRepo(supabase, user.id, input);
}
