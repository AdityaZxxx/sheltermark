"use server";

import type { ActionResult } from "~/lib/action-result";
import { requireAuth } from "~/lib/auth";
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

export async function getUserTags(): Promise<ActionResult<Tag[]>> {
  const { user, supabase } = await requireAuth();
  return getUserTagsRepo(supabase, user.id);
}

export async function getTagsWithCount(): Promise<
  ActionResult<TagWithCount[]>
> {
  const { user, supabase } = await requireAuth();
  return getTagsWithCountRepo(supabase, user.id);
}

export async function getWorkspaceTagsWithCount(
  workspaceId: string,
): Promise<ActionResult<TagWithCount[]>> {
  const { user, supabase } = await requireAuth();
  return getWorkspaceTagsWithCountRepo(supabase, user.id, workspaceId);
}

export async function getBookmarkTags(
  input: GetBookmarkTagsInput,
): Promise<ActionResult<Tag[]>> {
  const { supabase } = await requireAuth();
  return getBookmarkTagsRepo(supabase, input);
}

export async function addTagToBookmark(
  input: AddTagToBookmarkInput,
): Promise<ActionResult<Tag>> {
  const { user, supabase } = await requireAuth();
  return addTagToBookmarkRepo(supabase, user.id, input);
}

export async function removeTagFromBookmark(
  input: RemoveTagFromBookmarkInput,
): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();
  return removeTagFromBookmarkRepo(supabase, user.id, input);
}

export async function setBookmarkTags(
  input: SetBookmarkTagsInput,
): Promise<ActionResult<Tag[]>> {
  const { user, supabase } = await requireAuth();
  return setBookmarkTagsRepo(supabase, user.id, input);
}

export async function renameTag(
  input: RenameTagInput,
): Promise<ActionResult<Tag>> {
  const { user, supabase } = await requireAuth();

  // Friendly preflight: surface a clear duplicate-name error instead of a
  // raw unique-violation message. The DB constraint remains the source of
  // truth if this race misses.
  const existing = await getUserTagsRepo(supabase, user.id);
  if (existing.success) {
    const candidate = input.name.trim().toLowerCase();
    const duplicate = existing.data.some(
      (t) => t.id !== input.tagId && t.name.toLowerCase() === candidate,
    );
    if (duplicate) {
      return { success: false, error: "A tag with this name already exists" };
    }
  }

  return renameTagRepo(supabase, user.id, input);
}

export async function deleteTag(
  input: DeleteTagInput,
): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();
  return deleteTagRepo(supabase, user.id, input);
}
