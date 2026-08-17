import type { ActionResult } from "~/lib/action-result";
import type { DbClient } from "~/lib/data/db-client";
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

import {
  addTagToBookmarkSchema,
  deleteTagSchema,
  getBookmarkTagsSchema,
  removeTagFromBookmarkSchema,
  renameTagSchema,
  setBookmarkTagsSchema,
} from "~/lib/schemas/tag.schema";
import { resolveAndReplaceBookmarkTags } from "~/lib/services/tag.service";

export async function getUserTags(
  supabase: DbClient,
  userId: string,
): Promise<ActionResult<Tag[]>> {
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) return { success: false, error: error.message };
  // SAFETY: select("*") returns full tag rows scoped to user_id, matching the Tag schema shape.
  return { success: true, data: (data as Tag[]) ?? [] };
}

export async function getWorkspaceTagsWithCount(
  supabase: DbClient,
  userId: string,
  workspaceId: string,
): Promise<ActionResult<TagWithCount[]>> {
  const { data: bookmarks } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .is("deleted_at", null);

  // SAFETY: select("id") returns one non-null uuid column per bookmark row.
  const bookmarkIds = (bookmarks ?? []).map((b) => b.id as string);

  if (bookmarkIds.length === 0) {
    return { success: true, data: [] };
  }

  const { data: links, error } = await supabase
    .from("bookmark_tags")
    .select(
      `
      tag_id,
      tags:tag_id(id, user_id, name, created_at)
    `,
    )
    .in("bookmark_id", bookmarkIds)
    .eq("tags.user_id", userId);

  if (error) return { success: false, error: error.message };

  const countByTag = new Map<string, number>();
  const tagInfoMap = new Map<
    string,
    { id: string; user_id: string; name: string; created_at: string }
  >();

  for (const link of links ?? []) {
    // SAFETY: the join select returns tag_id plus the joined tags row (or array) for each bookmark_tags link.
    const row = link as { tag_id: string; tags: Tag | Tag[] | null };
    const tag = Array.isArray(row.tags) ? row.tags[0] : row.tags;
    if (!tag) continue;
    tagInfoMap.set(tag.id, tag);
    countByTag.set(tag.id, (countByTag.get(tag.id) ?? 0) + 1);
  }

  const tags: TagWithCount[] = Array.from(tagInfoMap.entries())
    .map(([id, info]) => ({
      id,
      user_id: info.user_id,
      name: info.name,
      created_at: info.created_at,
      count: countByTag.get(id) ?? 0,
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));

  return { success: true, data: tags };
}

export async function getTagsWithCount(
  supabase: DbClient,
  userId: string,
): Promise<ActionResult<TagWithCount[]>> {
  const { data, error } = await supabase
    .from("tags")
    .select(
      `
      id,
      user_id,
      name,
      created_at,
      bookmark_tags(count)
    `,
    )
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) return { success: false, error: error.message };

  // SAFETY: the join select returns tag rows with bookmark_tags count arrays, matching the asserted shape.
  const tags = (
    (data ?? []) as Array<Tag & { bookmark_tags: Array<{ count: number }> }>
  ).map((tag) => ({
    id: tag.id,
    user_id: tag.user_id,
    name: tag.name,
    created_at: tag.created_at,
    count: tag.bookmark_tags?.[0]?.count ?? 0,
  }));

  return { success: true, data: tags };
}

export async function getBookmarkTags(
  supabase: DbClient,
  input: GetBookmarkTagsInput,
): Promise<ActionResult<Tag[]>> {
  const validated = getBookmarkTagsSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { data, error } = await supabase
    .from("bookmark_tags")
    .select(
      `
      tag_id,
      tags (
        id,
        user_id,
        name,
        created_at
      )
    `,
    )
    .eq("bookmark_id", validated.data.bookmarkId);

  if (error) return { success: false, error: error.message };

  const tags = (data ?? [])
    .flatMap((row) => {
      // SAFETY: the join select returns each bookmark_tags row with the joined tags row (or array) attached.
      const rowTags = (row as { tags: Tag[] | Tag | null }).tags;
      if (Array.isArray(rowTags)) return rowTags;
      if (rowTags) return [rowTags];
      return [];
    })
    .filter((t): t is Tag => t !== null);

  return { success: true, data: tags };
}

export async function upsertTag(
  supabase: DbClient,
  userId: string,
  name: string,
): Promise<ActionResult<Tag>> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { success: false, error: "Tag name cannot be empty" };
  }

  const { data, error } = await supabase
    .from("tags")
    .upsert(
      { user_id: userId, name: trimmed },
      { onConflict: "user_id,name", ignoreDuplicates: false },
    )
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  // SAFETY: upsert().select().single() returns the upserted tag row scoped to user_id, matching the Tag schema shape.
  return { success: true, data: data as Tag };
}

export async function addTagToBookmark(
  supabase: DbClient,
  userId: string,
  input: AddTagToBookmarkInput,
): Promise<ActionResult<Tag>> {
  const validated = addTagToBookmarkSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { bookmarkId, tagId, name } = validated.data;

  let resolvedTag: Tag | null = null;

  if (tagId) {
    const { data: tag, error: tagError } = await supabase
      .from("tags")
      .select("*")
      .eq("id", tagId)
      .eq("user_id", userId)
      .single();

    if (tagError || !tag) {
      return { success: false, error: "Tag not found" };
    }
    // SAFETY: select("*") returns the full tag row filtered by id and user_id, matching the Tag schema shape.
    resolvedTag = tag as Tag;
  } else if (name) {
    const upsertResult = await upsertTag(supabase, userId, name);
    if (!upsertResult.success) return upsertResult;
    resolvedTag = upsertResult.data;
  } else {
    return { success: false, error: "Tag id or name required" };
  }

  if (!resolvedTag) {
    return { success: false, error: "Tag id or name required" };
  }

  const { error: linkError } = await supabase
    .from("bookmark_tags")
    .insert({ bookmark_id: bookmarkId, tag_id: resolvedTag.id });

  if (linkError && linkError.code !== "23505") {
    return { success: false, error: linkError.message };
  }

  return { success: true, data: resolvedTag };
}

export async function removeTagFromBookmark(
  supabase: DbClient,
  userId: string,
  input: RemoveTagFromBookmarkInput,
): Promise<ActionResult<null>> {
  const validated = removeTagFromBookmarkSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { bookmarkId, tagId } = validated.data;

  const { data: tag } = await supabase
    .from("tags")
    .select("id")
    .eq("id", tagId)
    .eq("user_id", userId)
    .single();

  if (!tag) return { success: false, error: "Tag not found" };

  const { error } = await supabase
    .from("bookmark_tags")
    .delete()
    .eq("bookmark_id", bookmarkId)
    .eq("tag_id", tagId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function setBookmarkTags(
  supabase: DbClient,
  userId: string,
  input: SetBookmarkTagsInput,
): Promise<ActionResult<Tag[]>> {
  const validated = setBookmarkTagsSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { bookmarkId, tags } = validated.data;

  const tagResult = await resolveAndReplaceBookmarkTags(
    supabase,
    userId,
    bookmarkId,
    tags,
  );
  if (!tagResult.success) return tagResult;

  return { success: true, data: tagResult.data };
}

export async function renameTag(
  supabase: DbClient,
  userId: string,
  input: RenameTagInput,
): Promise<ActionResult<Tag>> {
  const validated = renameTagSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { tagId, name } = validated.data;

  const { data, error } = await supabase
    .from("tags")
    .update({ name })
    .eq("id", tagId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  // SAFETY: update().select().single() returns the renamed tag row, matching the Tag schema shape.
  return { success: true, data: data as Tag };
}

export async function deleteTag(
  supabase: DbClient,
  userId: string,
  input: DeleteTagInput,
): Promise<ActionResult<null>> {
  const validated = deleteTagSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { tagId } = validated.data;

  const { error } = await supabase
    .from("tags")
    .delete()
    .eq("id", tagId)
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}
