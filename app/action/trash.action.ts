"use server";

import type { ActionResult } from "~/lib/action-result";
import { requireAuth } from "~/lib/auth";
import {
  getTrashedBookmarks as getTrashedBookmarksRepo,
  permanentDeleteBookmarks as permanentDeleteBookmarksRepo,
  restoreBookmarks as restoreBookmarksRepo,
} from "~/lib/data/repositories/bookmark.repository";
import {
  getTrashedWorkspaces as getTrashedWorkspacesRepo,
  permanentDeleteWorkspace as permanentDeleteWorkspaceRepo,
  restoreWorkspace as restoreWorkspaceRepo,
} from "~/lib/data/repositories/workspace.repository";
import type {
  Bookmark,
  BookmarkRestoreInput,
} from "~/lib/schemas/bookmark.schema";
import type { TrashedWorkspace } from "~/lib/schemas/workspace.schema";

export async function getTrashedBookmarks(): Promise<ActionResult<Bookmark[]>> {
  const { user, supabase } = await requireAuth();
  return getTrashedBookmarksRepo(supabase, user.id);
}

export async function getTrashedWorkspaces(): Promise<
  ActionResult<TrashedWorkspace[]>
> {
  const { user, supabase } = await requireAuth();
  return getTrashedWorkspacesRepo(supabase, user.id);
}

export async function restoreBookmarks(
  input: BookmarkRestoreInput,
): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();
  return restoreBookmarksRepo(supabase, user.id, input);
}

export async function restoreWorkspace(
  id: string,
): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();
  return restoreWorkspaceRepo(supabase, user.id, id);
}

export async function permanentDeleteBookmarks(
  ids: string[],
): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();
  return permanentDeleteBookmarksRepo(supabase, user.id, { ids });
}

export async function permanentDeleteWorkspace(
  id: string,
): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();
  return permanentDeleteWorkspaceRepo(supabase, user.id, id);
}

export async function emptyTrash(): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();

  const { error: bmError } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", user.id)
    .not("deleted_at", "is", null);

  if (bmError) return { success: false, error: bmError.message };

  const { error: wsError } = await supabase
    .from("workspaces")
    .delete()
    .eq("user_id", user.id)
    .not("deleted_at", "is", null);

  if (wsError) return { success: false, error: wsError.message };

  return { success: true, data: null };
}
