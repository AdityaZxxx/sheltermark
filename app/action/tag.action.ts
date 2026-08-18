"use server";

import type { ActionResult } from "~/lib/action-result";
import type {
  AddTagToBookmarkInput,
  DeleteTagInput,
  GetBookmarkTagsInput,
  RemoveTagFromBookmarkInput,
  RenameTagInput,
  SetBookmarkTagsInput,
  Tag,
  TagWithCount,
} from "~/lib/schemas/tag.schema";

import { requireAuth } from "~/lib/auth";
import { getDb } from "~/lib/data/drizzle";
import {
  addTagToBookmark as addTagToBookmarkRepo,
  deleteTag as deleteTagRepo,
  getBookmarkTags as getBookmarkTagsRepo,
  getTagsWithCount as getTagsWithCountRepo,
  getUserTags as getUserTagsRepo,
  getWorkspaceTagsWithCount as getWorkspaceTagsWithCountRepo,
  removeTagFromBookmark as removeTagFromBookmarkRepo,
  renameTag as renameTagRepo,
  setBookmarkTags as setBookmarkTagsRepo,
} from "~/lib/data/repositories/tag.repository";

export async function getUserTags(): Promise<ActionResult<Tag[]>> {
  const { user } = await requireAuth();
  return getUserTagsRepo(getDb(), user.id);
}

export async function getTagsWithCount(): Promise<
  ActionResult<TagWithCount[]>
> {
  const { user } = await requireAuth();
  return getTagsWithCountRepo(getDb(), user.id);
}

export async function getWorkspaceTagsWithCount(
  workspaceId: string,
): Promise<ActionResult<TagWithCount[]>> {
  const { user } = await requireAuth();
  return getWorkspaceTagsWithCountRepo(getDb(), user.id, workspaceId);
}

export async function getBookmarkTags(
  input: GetBookmarkTagsInput,
): Promise<ActionResult<Tag[]>> {
  const { user } = await requireAuth();
  return getBookmarkTagsRepo(getDb(), user.id, input);
}

export async function addTagToBookmark(
  input: AddTagToBookmarkInput,
): Promise<ActionResult<Tag>> {
  const { user } = await requireAuth();
  return addTagToBookmarkRepo(getDb(), user.id, input);
}

export async function removeTagFromBookmark(
  input: RemoveTagFromBookmarkInput,
): Promise<ActionResult<null>> {
  const { user } = await requireAuth();
  return removeTagFromBookmarkRepo(getDb(), user.id, input);
}

export async function setBookmarkTags(
  input: SetBookmarkTagsInput,
): Promise<ActionResult<Tag[]>> {
  const { user } = await requireAuth();
  return setBookmarkTagsRepo(getDb(), user.id, input);
}

export async function renameTag(
  input: RenameTagInput,
): Promise<ActionResult<Tag>> {
  const { user } = await requireAuth();

  // Friendly preflight: surface a clear duplicate-name error instead of a
  // raw unique-violation message. The DB constraint remains the source of
  // truth if this race misses.
  const existing = await getUserTagsRepo(getDb(), user.id);
  if (existing.success) {
    const candidate = input.name.trim().toLowerCase();
    const duplicate = existing.data.some(
      (t) => t.id !== input.tagId && t.name.toLowerCase() === candidate,
    );
    if (duplicate) {
      return { success: false, error: "A tag with this name already exists" };
    }
  }

  return renameTagRepo(getDb(), user.id, input);
}

export async function deleteTag(
  input: DeleteTagInput,
): Promise<ActionResult<null>> {
  const { user } = await requireAuth();
  return deleteTagRepo(getDb(), user.id, input);
}
