"use server";

import type { ActionResult } from "~/lib/action-result";
import type { WorkspaceWithCount } from "~/lib/schemas/workspace.schema";

import { requireAuth } from "~/lib/auth";
import { asDbClient } from "~/lib/data/db-client";
import {
  createWorkspace as createWorkspaceRepo,
  deleteWorkspace as deleteWorkspaceRepo,
  getWorkspaces as getWorkspacesRepo,
  renameWorkspace as renameWorkspaceRepo,
  setDefaultWorkspace as setDefaultWorkspaceRepo,
  toggleAutoCheckBroken as toggleAutoCheckBrokenRepo,
  togglePublicStatus as togglePublicStatusRepo,
} from "~/lib/data/repositories/workspace.repository";

/** See bookmark.action.ts for the cast rationale. */
async function auth() {
  const { user, supabase } = await requireAuth();
  return { user, db: asDbClient(supabase) };
}

export async function getWorkspaces(): Promise<
  ActionResult<WorkspaceWithCount[]>
> {
  const { user, db } = await auth();
  return getWorkspacesRepo(db, user.id);
}

export async function createWorkspace(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const { user, db } = await auth();
  return createWorkspaceRepo(db, user.id, formData);
}

export async function deleteWorkspace(id: string): Promise<ActionResult<null>> {
  const { user, db } = await auth();
  return deleteWorkspaceRepo(db, user.id, id);
}

export async function togglePublicStatus(
  id: string,
  isPublic: boolean,
): Promise<ActionResult<null>> {
  const { user, db } = await auth();
  return togglePublicStatusRepo(db, user.id, id, isPublic);
}

export async function setDefaultWorkspace(
  id: string,
): Promise<ActionResult<null>> {
  const { user, db } = await auth();
  return setDefaultWorkspaceRepo(db, user.id, id);
}

export async function toggleAutoCheckBroken(
  id: string,
  enabled: boolean,
): Promise<ActionResult<null>> {
  const { user, db } = await auth();
  return toggleAutoCheckBrokenRepo(db, user.id, id, enabled);
}

export async function renameWorkspace(
  id: string,
  name: string,
): Promise<ActionResult<null>> {
  const { user, db } = await auth();
  return renameWorkspaceRepo(db, user.id, id, name);
}
