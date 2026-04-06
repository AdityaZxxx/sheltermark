"use server";

import { requireAuth } from "~/lib/auth";
import { insertBookmark } from "~/lib/bookmark";
import { fetchMetadata } from "~/lib/metadata";
import { bookmarkCreateSchema } from "~/lib/schemas";

export async function addBookmark(formData: FormData) {
  const rawUrl = formData.get("url") as string;
  const workspaceId = formData.get("workspaceId") as string;

  const validated = bookmarkCreateSchema.safeParse({
    url: rawUrl,
    workspaceId: workspaceId === "null" || !workspaceId ? null : workspaceId,
  });

  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  const { user, supabase } = await requireAuth();

  const result = await insertBookmark(supabase, user.id, {
    url: validated.data.url,
    workspaceId: validated.data.workspaceId,
  });

  if (!result.success) {
    if (result.duplicate) {
      throw new Error("Bookmark already exists in this workspace");
    }
    throw new Error(result.error);
  }

  return { success: true, data: result.data };
}

export async function deleteBookmarks(ids: string[]) {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .in("id", ids)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  return { success: true };
}

export async function moveBookmarks(ids: string[], targetWorkspaceId: string) {
  const { user, supabase } = await requireAuth();
  const targetId = targetWorkspaceId === "null" ? null : targetWorkspaceId;

  // 1. Get the URLs of the bookmarks to be moved
  const { data: sourceBookmarks, error: fetchError } = await supabase
    .from("bookmarks")
    .select("id, url")
    .in("id", ids)
    .eq("user_id", user.id);

  if (fetchError) return { error: fetchError.message };
  if (!sourceBookmarks || sourceBookmarks.length === 0)
    return { error: "No bookmarks found to move" };

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

  if (checkError) return { error: checkError.message };

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
      .update({ workspace_id: targetId })
      .in("id", toMoveIds)
      .eq("user_id", user.id);

    if (moveError) return { error: moveError.message };
  }

  return {
    success: true,
    movedCount: toMoveIds.length,
    skippedCount,
  };
}

export async function renameBookmark(id: string, title: string) {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("bookmarks")
    .update({ title })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  return { success: true };
}

export async function refetchBookmarkMetadata(id: string) {
  const { user, supabase } = await requireAuth();

  const { data: bookmark, error: fetchError } = await supabase
    .from("bookmarks")
    .select("id, url, favicon_url, og_image_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !bookmark) return { error: "Bookmark not found" };

  const metadata = await fetchMetadata(bookmark.url);

  const { error: updateError } = await supabase
    .from("bookmarks")
    .update({
      favicon_url: metadata.favicon_url,
      og_image_url: metadata.og_image_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) return { error: updateError.message };

  return { success: true };
}

export async function getBookmarks() {
  const { user, supabase } = await requireAuth();

  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return { data: data || [], error: error?.message };
}
