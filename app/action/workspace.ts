"use server";

import type { ActionResult } from "~/lib/action-result";
import { requireAuth } from "~/lib/auth";
import type { WorkspaceWithCount } from "~/lib/schemas/workspace";
import {
  workspaceCreateSchema,
  workspaceRenameSchema,
} from "~/lib/schemas/workspace";

export async function getWorkspaces(): Promise<
  ActionResult<WorkspaceWithCount[]>
> {
  const { user, supabase } = await requireAuth();

  const { data, error } = await supabase
    .from("workspaces")
    .select(`
      *,
      bookmarks(count)
    `)
    .order("created_at", { ascending: true })
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  const result = (data || []).map((workspace) => ({
    ...workspace,
    bookmarks_count:
      (workspace.bookmarks as unknown as { count: number }[])?.[0]?.count ?? 0,
    // Remove the raw bookmarks data to keep the payload clean
    bookmarks: undefined,
  }));

  return { success: true, data: result };
}

export async function createWorkspace(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const rawData = Object.fromEntries(formData.entries());
  const validated = workspaceCreateSchema.safeParse(rawData);

  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message };
  }

  const { user, supabase } = await requireAuth();

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

  if (error) return { success: false, error: error.message };

  // The inserted workspace returns a row which includes an `id` field.
  // Narrow the return type to only expose the `id` to callers.
  const inserted = data as { id: string } | null;
  const id = inserted?.id;
  if (typeof id !== "string") {
    return { success: false, error: "Invalid workspace data returned" };
  }
  return { success: true, data: { id } };
}

export async function deleteWorkspace(id: string): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();

  // Check if it's default
  const { data: ws } = await supabase
    .from("workspaces")
    .select("is_default")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (ws?.is_default)
    return { success: false, error: "Cannot delete default workspace" };

  const { error } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  return { success: true, data: null };
}

export async function togglePublicStatus(
  id: string,
  isPublic: boolean,
): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("workspaces")
    .update({ is_public: isPublic })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  return { success: true, data: null };
}

export async function setDefaultWorkspace(
  id: string,
): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();

  // First, unset all defaults
  const { error: unsetError } = await supabase
    .from("workspaces")
    .update({ is_default: false })
    .eq("user_id", user.id);

  if (unsetError) return { success: false, error: unsetError.message };

  // Then set the new default
  const { error } = await supabase
    .from("workspaces")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  return { success: true, data: null };
}

export async function toggleAutoCheckBroken(
  id: string,
  enabled: boolean,
): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("workspaces")
    .update({ auto_check_broken: enabled })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  return { success: true, data: null };
}

export async function renameWorkspace(
  id: string,
  name: string,
): Promise<ActionResult<null>> {
  const validated = workspaceRenameSchema.safeParse({ id, name });

  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message };
  }

  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("workspaces")
    .update({ name: validated.data.name })
    .eq("id", validated.data.id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  return { success: true, data: null };
}
