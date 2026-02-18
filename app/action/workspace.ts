"use server";

import { requireAuth } from "~/lib/auth";
import { workspaceCreateSchema } from "~/lib/schemas";

export async function getWorkspaces() {
  const { supabase } = await requireAuth();

  const { data, error } = await supabase
    .from("workspaces")
    .select(`
      *,
      bookmarks(count)
    `)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((workspace) => ({
    ...workspace,
    bookmarks_count:
      (workspace.bookmarks as unknown as { count: number }[])?.[0]?.count ?? 0,
    // Remove the raw bookmarks data to keep the payload clean
    bookmarks: undefined,
  }));
}

export async function createWorkspace(formData: FormData) {
  const rawData = Object.fromEntries(formData.entries());
  const validated = workspaceCreateSchema.safeParse(rawData);

  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  const { user, supabase } = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("workspaces")
    .insert([
      {
        name: validated.data.name,
        user_id: user.id,
        is_default: false,
        is_public: false,
      },
    ])
    .select()
    .single();

  if (error) return { error: error.message };

  return { success: true, data };
}

export async function deleteWorkspace(id: string) {
  const { user, supabase } = await requireAuth();

  // Check if it's default
  const { data: ws } = await supabase
    .from("workspaces")
    .select("is_default")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (ws?.is_default) return { error: "Cannot delete default workspace" };

  const { error } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  return { success: true };
}

export async function togglePublicStatus(id: string, isPublic: boolean) {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("workspaces")
    .update({ is_public: isPublic })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  return { success: true };
}
