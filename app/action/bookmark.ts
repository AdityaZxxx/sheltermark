"use server";

import { z } from "zod";
import { requireAuth } from "~/lib/auth";
import { fetchMetadata } from "~/lib/metadata";

const bookmarkSchema = z.object({
  url: z.url("invalid URL"),
  workspaceId: z.uuid().nullable(),
});

export async function addBookmark(formData: FormData) {
  const rawUrl = formData.get("url") as string;
  const workspaceId = formData.get("workspaceId") as string;

  const validated = bookmarkSchema.safeParse({
    url: rawUrl,
    workspaceId: workspaceId === "null" || !workspaceId ? null : workspaceId,
  });

  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  const { user, supabase } = await requireAuth();

  // Check if bookmark already exists in workspace (BEFORE fetching metadata)
  const workspaceIdValue = validated.data.workspaceId;
  let existingQuery = supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", user.id)
    .eq("url", validated.data.url);

  if (workspaceIdValue) {
    existingQuery = existingQuery.eq("workspace_id", workspaceIdValue);
  } else {
    existingQuery = existingQuery.is("workspace_id", null);
  }

  // Parallel: check duplicate + fetch metadata simultaneously
  const [existing, metadata] = await Promise.all([
    existingQuery.maybeSingle(),
    fetchMetadata(validated.data.url),
  ]);

  if (existing.data) {
    return { error: "Bookmark already exists in this workspace" };
  }

  const insertData = {
    user_id: user.id,
    url: validated.data.url,
    title: metadata.title,
    favicon_url: metadata.favicon_url,
    og_image_url: metadata.og_image_url,
    workspace_id: validated.data.workspaceId,
  };

  const { data, error } = await supabase
    .from("bookmarks")
    .insert([insertData])
    .select()
    .single();

  if (error) return { error: error.message };

  return { success: true, data };
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

  const { error } = await supabase
    .from("bookmarks")
    .update({
      workspace_id: targetWorkspaceId === "null" ? null : targetWorkspaceId,
    })
    .in("id", ids)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  return { success: true };
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

export async function getBookmarks() {
  const { user, supabase } = await requireAuth();

  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return { data: data || [], error: error?.message };
}
