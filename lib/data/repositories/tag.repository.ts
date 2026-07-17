import type { SupabaseClient } from "@supabase/supabase-js";
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
import {
  addTagToBookmarkSchema,
  deleteTagSchema,
  getBookmarkTagsSchema,
  removeTagFromBookmarkSchema,
  renameTagSchema,
  setBookmarkTagsSchema,
} from "~/lib/schemas/tag.schema";

export async function getUserTags(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActionResult<Tag[]>> {
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data as Tag[]) ?? [] };
}

export async function getTagsWithCount(
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
      const rowTags = (row as unknown as { tags: Tag[] | Tag | null }).tags;
      if (Array.isArray(rowTags)) return rowTags;
      if (rowTags) return [rowTags];
      return [];
    })
    .filter((t): t is Tag => t !== null);

  return { success: true, data: tags };
}

export async function upsertTag(
  supabase: SupabaseClient,
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
  return { success: true, data: data as Tag };
}

export async function addTagToBookmark(
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
  userId: string,
  input: SetBookmarkTagsInput,
): Promise<ActionResult<Tag[]>> {
  const validated = setBookmarkTagsSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { bookmarkId, tags } = validated.data;

  const resolvedTags: Tag[] = [];

  for (const entry of tags) {
    if (entry.id) {
      const { data: tag, error } = await supabase
        .from("tags")
        .select("*")
        .eq("id", entry.id)
        .eq("user_id", userId)
        .single();
      if (error || !tag) {
        return { success: false, error: "One or more tags not found" };
      }
      resolvedTags.push(tag as Tag);
    } else if (entry.name) {
      const upsertResult = await upsertTag(supabase, userId, entry.name);
      if (!upsertResult.success) return upsertResult;
      resolvedTags.push(upsertResult.data);
    }
  }

  const { error: deleteError } = await supabase
    .from("bookmark_tags")
    .delete()
    .eq("bookmark_id", bookmarkId);

  if (deleteError) return { success: false, error: deleteError.message };

  if (resolvedTags.length > 0) {
    const { error: insertError } = await supabase.from("bookmark_tags").insert(
      resolvedTags.map((tag) => ({
        bookmark_id: bookmarkId,
        tag_id: tag.id,
      })),
    );

    if (insertError) return { success: false, error: insertError.message };
  }

  return { success: true, data: resolvedTags };
}

export async function renameTag(
  supabase: SupabaseClient,
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
  return { success: true, data: data as Tag };
}

export async function deleteTag(
  supabase: SupabaseClient,
  userId: string,
  input: DeleteTagInput,
): Promise<ActionResult<null>> {
  const validated = deleteTagSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }

  const { tagId } = validated.data;

  // Clean up junction table rows first to avoid orphaned references
  const { error: linkError } = await supabase
    .from("bookmark_tags")
    .delete()
    .eq("tag_id", tagId);

  if (linkError) return { success: false, error: linkError.message };

  const { error } = await supabase
    .from("tags")
    .delete()
    .eq("id", tagId)
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}
