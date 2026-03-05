import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMetadata } from "~/lib/metadata";

export type InsertBookmarkParams = {
  url: string;
  workspaceId: string | null | undefined;
  clientTitle?: string | null;
};

export type InsertBookmarkResult =
  | { success: true; data: unknown }
  | { success: false; duplicate: true }
  | { success: false; duplicate?: false; error: string };

/**
 * Shared bookmark insert service — used by both server actions and API route handlers.
 * Performs duplicate check + metadata fetch in parallel before inserting.
 * workspaceId=null means "no workspace" (stored as null in DB).
 */
export async function insertBookmark(
  supabase: SupabaseClient,
  userId: string,
  { url, workspaceId, clientTitle }: InsertBookmarkParams,
): Promise<InsertBookmarkResult> {
  // Build duplicate check query
  let existingQuery = supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", userId)
    .eq("url", url);

  if (workspaceId) {
    existingQuery = existingQuery.eq("workspace_id", workspaceId);
  } else {
    existingQuery = existingQuery.is("workspace_id", null);
  }

  // Parallel: duplicate check + metadata fetch — no sequential waiting
  const [existing, metadata] = await Promise.all([
    existingQuery.maybeSingle(),
    fetchMetadata(url),
  ]);

  if (existing.data) {
    return { success: false, duplicate: true };
  }

  const title = metadata.title || clientTitle || "";

  const { data, error } = await supabase
    .from("bookmarks")
    .insert([
      {
        user_id: userId,
        url,
        workspace_id: workspaceId ?? null,
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
