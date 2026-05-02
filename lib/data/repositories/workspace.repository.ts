import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionResult } from "~/lib/action-result";
import type { WorkspaceWithCount } from "~/lib/schemas/workspace.schema";
import {
  workspaceCreateSchema,
  workspaceRenameSchema,
} from "~/lib/schemas/workspace.schema";

export async function getWorkspaces(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActionResult<WorkspaceWithCount[]>> {
  const { data, error } = await supabase
    .from("workspaces")
    .select(`*, bookmarks(count)`)
    .order("created_at", { ascending: true })
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };

  const result = (data || []).map((workspace) => ({
    ...workspace,
    bookmarks_count:
      (workspace as { bookmarks?: { count: number }[] }).bookmarks?.[0]
        ?.count ?? 0,
    bookmarks: undefined,
  }));

  return { success: true, data: result as WorkspaceWithCount[] };
}

export async function createWorkspace(
  supabase: SupabaseClient,
  userId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const rawData = Object.fromEntries(formData.entries());
  const validated = workspaceCreateSchema.safeParse(rawData);
  if (!validated.success) {
    const msg =
      validated.error?.issues?.[0]?.message ?? "Invalid workspace data";
    return { success: false, error: msg };
  }

  const { data, error } = await supabase
    .from("workspaces")
    .insert([
      {
        name: validated.data.name,
        user_id: userId,
        is_default: false,
        is_public: false,
      },
    ])
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  const id = (data as { id: string } | null)?.id;
  if (typeof id !== "string") {
    return { success: false, error: "Invalid workspace data returned" };
  }
  return { success: true, data: { id } };
}

export async function deleteWorkspace(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<ActionResult<null>> {
  // Check if it's default
  const { data: ws } = await supabase
    .from("workspaces")
    .select("is_default")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (ws?.is_default) {
    return { success: false, error: "Cannot delete default workspace" };
  }

  const { error } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function togglePublicStatus(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  isPublic: boolean,
): Promise<ActionResult<null>> {
  const { error } = await supabase
    .from("workspaces")
    .update({ is_public: isPublic })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function setDefaultWorkspace(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<ActionResult<null>> {
  // First, unset all defaults
  const { error: unsetError } = await supabase
    .from("workspaces")
    .update({ is_default: false })
    .eq("user_id", userId);
  if (unsetError) return { success: false, error: unsetError.message };

  // Then set the new default
  const { error: setError } = await supabase
    .from("workspaces")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", userId);
  if (setError) return { success: false, error: setError.message };
  return { success: true, data: null };
}

export async function toggleAutoCheckBroken(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  enabled: boolean,
): Promise<ActionResult<null>> {
  const { error } = await supabase
    .from("workspaces")
    .update({ auto_check_broken: enabled })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function createWorkspaceRaw(
  supabase: SupabaseClient,
  userId: string,
  name: string,
): Promise<ActionResult<{ id: string }>> {
  const { data, error } = await supabase
    .from("workspaces")
    .insert({
      name,
      user_id: userId,
      is_default: false,
      is_public: false,
    })
    .select("id")
    .single();

  if (error) {
    return {
      success: false,
      error: `Failed to create workspace: ${error.message}`,
    };
  }

  if (!data) {
    return {
      success: false,
      error: "Failed to create workspace: no data returned",
    };
  }

  return { success: true, data: { id: data.id } };
}

export async function getDefaultWorkspace(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActionResult<{ id: string } | null>> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data ?? null };
}

export async function renameWorkspace(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  name: string,
): Promise<ActionResult<null>> {
  const validated = workspaceRenameSchema.safeParse({ id, name });
  if (!validated.success) {
    const msg =
      validated.error?.issues?.[0]?.message ?? "Invalid workspace data";
    return { success: false, error: msg };
  }

  const { error } = await supabase
    .from("workspaces")
    .update({ name: validated.data.name })
    .eq("id", validated.data.id)
    .eq("user_id", userId);
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}
