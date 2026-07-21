import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionResult } from "~/lib/action-result";
import { upsertTag } from "~/lib/data/repositories/tag.repository";
import type { Tag } from "~/lib/schemas/tag.schema";

export type TagServiceEntry = { id?: string; name?: string };

export async function resolveAndReplaceBookmarkTags(
  supabase: SupabaseClient,
  userId: string,
  bookmarkId: string,
  tags: TagServiceEntry[],
): Promise<ActionResult<Tag[]>> {
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

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  if (resolvedTags.length > 0) {
    const { error: insertError } = await supabase.from("bookmark_tags").insert(
      resolvedTags.map((tag) => ({
        bookmark_id: bookmarkId,
        tag_id: tag.id,
      })),
    );

    if (insertError) {
      return { success: false, error: insertError.message };
    }
  }

  return { success: true, data: resolvedTags };
}
