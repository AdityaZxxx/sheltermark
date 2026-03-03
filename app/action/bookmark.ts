"use server";

import { requireAuth } from "~/lib/auth";
import { insertBookmark } from "~/lib/bookmark";
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
    if (result.duplicate)
      return { error: "Bookmark already exists in this workspace" };
    return { error: result.error };
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
