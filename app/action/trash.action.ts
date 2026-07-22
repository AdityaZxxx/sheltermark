"use server";

import type { ActionResult } from "~/lib/action-result";
import { requireAuth } from "~/lib/auth";
import {
  getTrashedBookmarks as getTrashedBookmarksRepo,
  permanentDeleteBookmarks as permanentDeleteBookmarksRepo,
} from "~/lib/data/repositories/bookmark.repository";
import {
  getTrashedWorkspaces as getTrashedWorkspacesRepo,
  permanentDeleteWorkspace as permanentDeleteWorkspaceRepo,
} from "~/lib/data/repositories/workspace.repository";
import { emptyUserTrash } from "~/lib/data/transaction";
import {
  restoreBookmarks as restoreBookmarksService,
  restoreWorkspace as restoreWorkspaceService,
} from "~/lib/restore";
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
): Promise<ActionResult<{ restoredCount: number; skippedCount: number }>> {
  const { user, supabase } = await requireAuth();
  return restoreBookmarksService(supabase, user.id, input);
}

export async function restoreWorkspace(
  id: string,
): Promise<ActionResult<{ restoredCount: number; skippedCount: number }>> {
  const { user, supabase } = await requireAuth();
  return restoreWorkspaceService(supabase, user.id, id);
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
  return emptyUserTrash(supabase, user.id);
}
