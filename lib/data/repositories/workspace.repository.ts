import { z } from "zod";

import type { ActionResult } from "~/lib/action-result";
import type { DbClient } from "~/lib/data/db-client";
import type { Bookmark } from "~/lib/schemas/bookmark.schema";
import type {
  TrashedWorkspace,
  Workspace,
  WorkspaceWithCount,
} from "~/lib/schemas/workspace.schema";

import { deleteWorkspaceWithBookmarks } from "~/lib/data/transaction";
import {
  workspaceCreateSchema,
  workspaceRenameSchema,
} from "~/lib/schemas/workspace.schema";

const workspaceIdRowSchema = z.object({ id: z.string().min(1) });

export async function getWorkspaces(
  supabase: DbClient,
  userId: string,
): Promise<ActionResult<WorkspaceWithCount[]>> {
  const [workspacesResult, countsResult] = await Promise.all([
    supabase
      .from("workspaces")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("bookmarks")
      .select("workspace_id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .not("workspace_id", "is", null),
  ]);

  if (workspacesResult.error)
    return { success: false, error: workspacesResult.error.message };

  const countMap = new Map<string, number>();
  // SAFETY: select("workspace_id") with .not("workspace_id","is",null) returns rows whose only column is a non-null uuid string.
  for (const row of (countsResult.data ?? []) as Array<{
    workspace_id: string;
  }>) {
    countMap.set(row.workspace_id, (countMap.get(row.workspace_id) ?? 0) + 1);
  }

  // SAFETY: rows come from the workspaces table with all columns selected, matching the Workspace schema shape.
  const workspaces = (workspacesResult.data ?? []) as Workspace[];

  return {
    success: true,
    data: workspaces.map((workspace) => ({
      ...workspace,
      bookmarks_count: countMap.get(workspace.id) ?? 0,
    })),
  };
}

export async function createWorkspace(
  supabase: DbClient,
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

  const parsed = workspaceIdRowSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Invalid workspace data returned" };
  }
  return { success: true, data: { id: parsed.data.id } };
}

export async function deleteWorkspace(
  supabase: DbClient,
  userId: string,
  id: string,
): Promise<ActionResult<null>> {
  return deleteWorkspaceWithBookmarks(supabase, userId, id);
}

export async function getTrashedWorkspaces(
  supabase: DbClient,
  userId: string,
): Promise<ActionResult<TrashedWorkspace[]>> {
  const [workspacesResult, bookmarksResult] = await Promise.all([
    supabase
      .from("workspaces")
      .select("*")
      .eq("user_id", userId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("bookmarks")
      .select("*")
      .eq("user_id", userId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
  ]);

  if (workspacesResult.error)
    return { success: false, error: workspacesResult.error.message };

  const trashedWorkspaceIds = new Set(
    (workspacesResult.data ?? []).map((ws) => ws.id),
  );

  const bookmarksByWs = new Map<string, Bookmark[]>();
  const standaloneBookmarks: Bookmark[] = [];
  // SAFETY: rows come from the bookmarks table with all columns selected, matching the Bookmark schema shape.
  for (const bm of (bookmarksResult.data ?? []) as Bookmark[]) {
    if (bm.workspace_id && trashedWorkspaceIds.has(bm.workspace_id)) {
      const list = bookmarksByWs.get(bm.workspace_id) ?? [];
      list.push(bm);
      bookmarksByWs.set(bm.workspace_id, list);
    } else {
      standaloneBookmarks.push(bm);
    }
  }

  // SAFETY: rows come from the workspaces table with all columns selected, matching the Workspace schema shape.
  const workspaces = (workspacesResult.data ?? []) as Workspace[];

  return {
    success: true,
    data: workspaces.map((workspace) => ({
      ...workspace,
      bookmarks_count: bookmarksByWs.get(workspace.id)?.length ?? 0,
      bookmarks: bookmarksByWs.get(workspace.id) ?? [],
    })),
  };
}

export async function permanentDeleteWorkspace(
  supabase: DbClient,
  userId: string,
  id: string,
): Promise<ActionResult<null>> {
  // Hard-delete bookmarks first (avoids CASCADE issues with tracking)
  const { error: bmError } = await supabase
    .from("bookmarks")
    .delete()
    .eq("workspace_id", id)
    .eq("user_id", userId);

  if (bmError) return { success: false, error: bmError.message };

  const { error } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function emptyTrashWorkspaces(
  supabase: DbClient,
  userId: string,
): Promise<ActionResult<null>> {
  // Hard-delete all trashed bookmarks first
  const { error: bmError } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", userId)
    .not("deleted_at", "is", null);

  if (bmError) return { success: false, error: bmError.message };

  // Then hard-delete trashed workspaces (CASCADE handles remaining bookmarks)
  const { error } = await supabase
    .from("workspaces")
    .delete()
    .eq("user_id", userId)
    .not("deleted_at", "is", null);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function togglePublicStatus(
  supabase: DbClient,
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
  supabase: DbClient,
  userId: string,
  id: string,
): Promise<ActionResult<null>> {
  const { error: unsetError } = await supabase
    .from("workspaces")
    .update({ is_default: false })
    .eq("user_id", userId);
  if (unsetError) return { success: false, error: unsetError.message };

  const { error: setError } = await supabase
    .from("workspaces")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", userId);
  if (setError) return { success: false, error: setError.message };
  return { success: true, data: null };
}

export async function toggleAutoCheckBroken(
  supabase: DbClient,
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
  supabase: DbClient,
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

  // SAFETY: select("id").single() above returns the inserted row whose only column is id: uuid string; the !data case already errored.
  return { success: true, data: { id: (data as { id: string }).id } };
}

export async function getDefaultWorkspace(
  supabase: DbClient,
  userId: string,
): Promise<ActionResult<{ id: string } | null>> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  // SAFETY: select("id") returns at most one row with a single id: uuid column, or null when no row matches.
  return { success: true, data: data as { id: string } | null };
}

export async function renameWorkspace(
  supabase: DbClient,
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
