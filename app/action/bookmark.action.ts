"use server";

import type { ActionResult } from "~/lib/action-result";
import type {
  Bookmark,
  BookmarkCreateInput,
  BookmarkDeleteInput,
  BookmarkEditInput,
  BookmarkMoveInput,
  BookmarkRefetchMetadataInput,
  BookmarkRenameInput,
  BookmarkUpdateNoteInput,
  GenerateAiTitleInput,
} from "~/lib/schemas/bookmark.schema";
import type { Tag } from "~/lib/schemas/tag.schema";

import { requireAuth } from "~/lib/auth";
import { getDb } from "~/lib/data/db";
import {
  deleteBookmarks as deleteBookmarksRepo,
  generateAiTitleRepo,
  getBookmarks as getBookmarksRepo,
  insertBookmark as insertBookmarkRepo,
  moveBookmarks as moveBookmarksRepo,
  refetchMetadata as refetchMetadataRepo,
  renameBookmark as renameBookmarkRepo,
  suggestBookmarkTagsRepo,
  updateBookmarkFields as updateBookmarkFieldsRepo,
  updateBookmarkNote as updateBookmarkNoteRepo,
} from "~/lib/data/repositories/bookmark.repository";

async function auth() {
  const { user } = await requireAuth();
  return { user, db: getDb() };
}

export async function addBookmark(
  data: BookmarkCreateInput,
): Promise<ActionResult<Bookmark>> {
  const { user, db } = await auth();
  const result = await insertBookmarkRepo(db, user.id, data);
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

export async function generateAiTitle(
  input: GenerateAiTitleInput,
): Promise<ActionResult<{ suggestion: string }>> {
  const { user, db } = await auth();
  return generateAiTitleRepo(db, user.id, input);
}

export async function suggestBookmarkTags(
  input: GenerateAiTitleInput,
): Promise<ActionResult<{ suggestions: string[] }>> {
  const { user, db } = await auth();
  return suggestBookmarkTagsRepo(db, user.id, input);
}

export async function deleteBookmarks({
  ids,
}: BookmarkDeleteInput): Promise<ActionResult<null>> {
  const { user, db } = await auth();
  return deleteBookmarksRepo(db, user.id, { ids });
}

export async function moveBookmarks({
  ids,
  targetWorkspaceId,
}: BookmarkMoveInput): Promise<
  ActionResult<{ movedCount: number; skippedCount: number }>
> {
  const { user, db } = await auth();
  return moveBookmarksRepo(db, user.id, { ids, targetWorkspaceId });
}

export async function renameBookmark({
  id,
  title,
}: BookmarkRenameInput): Promise<ActionResult<null>> {
  const { user, db } = await auth();
  return renameBookmarkRepo(db, user.id, { id, title });
}

export async function updateBookmarkNote({
  id,
  note,
}: BookmarkUpdateNoteInput): Promise<ActionResult<null>> {
  const { user, db } = await auth();
  return updateBookmarkNoteRepo(db, user.id, { id, note });
}

export async function refetchBookmarkMetadata(
  id: BookmarkRefetchMetadataInput,
): Promise<ActionResult<null>> {
  const { user, db } = await auth();
  return refetchMetadataRepo(db, user.id, id);
}

export async function getBookmarks(
  workspaceId?: string,
): Promise<ActionResult<Bookmark[]>> {
  const { user, db } = await auth();
  return getBookmarksRepo(db, user.id, workspaceId);
}

export async function updateBookmarkFields(
  input: BookmarkEditInput,
): Promise<ActionResult<Tag[]>> {
  const { user, db } = await auth();
  return updateBookmarkFieldsRepo(db, user.id, input);
}
