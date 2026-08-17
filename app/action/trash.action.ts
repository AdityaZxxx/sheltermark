"use server";

import type { ActionResult } from "~/lib/action-result";
import type {
  Bookmark,
  BookmarkRestoreInput,
} from "~/lib/schemas/bookmark.schema";
import type { TrashedWorkspace } from "~/lib/schemas/workspace.schema";

import { requireAuth } from "~/lib/auth";
import { asDbClient } from "~/lib/data/db-client";
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

/**
 * Returns the authenticated user and a DbClient-typed view of the
 * Supabase client. See `bookmark.action.ts` for the cast rationale.
 */
async function auth() {
  const { user, supabase } = await requireAuth();
  return { user, db: asDbClient(supabase) };
}

export async function getTrashedBookmarks(): Promise<ActionResult<Bookmark[]>> {
  const { user, db } = await auth();
  return getTrashedBookmarksRepo(db, user.id);
}

export async function getTrashedWorkspaces(): Promise<
  ActionResult<TrashedWorkspace[]>
> {
  const { user, db } = await auth();
  return getTrashedWorkspacesRepo(db, user.id);
}

export async function restoreBookmarks(
  input: BookmarkRestoreInput,
): Promise<ActionResult<{ restoredCount: number; skippedCount: number }>> {
  const { user, db } = await auth();
  return restoreBookmarksService(db, user.id, input);
}

export async function restoreWorkspace(
  id: string,
): Promise<ActionResult<{ restoredCount: number; skippedCount: number }>> {
  const { user, db } = await auth();
  return restoreWorkspaceService(db, user.id, id);
}

export async function permanentDeleteBookmarks(
  ids: string[],
): Promise<ActionResult<null>> {
  const { user, db } = await auth();
  return permanentDeleteBookmarksRepo(db, user.id, { ids });
}

export async function permanentDeleteWorkspace(
  id: string,
): Promise<ActionResult<null>> {
  const { user, db } = await auth();
  return permanentDeleteWorkspaceRepo(db, user.id, id);
}

export async function emptyTrash(): Promise<ActionResult<null>> {
  const { user, db } = await auth();
  return emptyUserTrash(db, user.id);
}
