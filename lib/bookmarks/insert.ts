import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMetadata } from "~/lib/metadata";
import type { Bookmark } from "~/lib/schemas/bookmark";
import { normalizeUrl } from "~/lib/utils";

type InsertBookmarkParams = {
  url: string;
  workspaceId: string;
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

  const title = metadata.title || clientTitle;

  const { data, error } = await supabase
    .from("bookmarks")
    .insert([
      {
        user_id: userId,
        url: normalizedUrl,
        workspace_id: workspaceId || null,
        title,
        favicon_url: metadata.favicon_url,
        og_image_url: metadata.og_image_url,
      },
    ])
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}
