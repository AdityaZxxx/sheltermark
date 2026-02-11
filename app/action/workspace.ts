"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "~/utils/supabase/server";

const workspaceSchema = z.object({
  name: z
    .string()
    .min(1, "Workspace name is required")
    .max(50, "Name too long"),
});

export async function getWorkspaces() {
  const supabase = await createClient();
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
  const supabase = await createClient();
  const rawData = Object.fromEntries(formData.entries());
  const validated = workspaceSchema.safeParse(rawData);

  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("workspaces")
    .insert([
      {
        name: validated.data.name,
        user_id: userData.user.id,
        is_default: false,
        is_public: false,
      },
    ])
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true, data };
}

export async function deleteWorkspace(id: string) {
  const supabase = await createClient();

  // Check if it's default
  const { data: ws } = await supabase
    .from("workspaces")
    .select("is_default")
    .eq("id", id)
    .single();

  if (ws?.is_default) return { error: "Cannot delete default workspace" };

  const { error } = await supabase.from("workspaces").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

export async function togglePublicStatus(id: string, isPublic: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("workspaces")
    .update({ is_public: isPublic })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}
