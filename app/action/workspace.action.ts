"use server";

import type { ActionResult } from "~/lib/action-result";
import { requireAuth } from "~/lib/auth";
import {
  createWorkspace as createWorkspaceRepo,
  deleteWorkspace as deleteWorkspaceRepo,
  getWorkspaces as getWorkspacesRepo,
  renameWorkspace as renameWorkspaceRepo,
  setDefaultWorkspace as setDefaultWorkspaceRepo,
  toggleAutoCheckBroken as toggleAutoCheckBrokenRepo,
  togglePublicStatus as togglePublicStatusRepo,
} from "~/lib/data/repositories/workspace.repository";
import type { WorkspaceWithCount } from "~/lib/schemas/workspace.schema";

export async function getWorkspaces(): Promise<
  ActionResult<WorkspaceWithCount[]>
> {
  const { user, supabase } = await requireAuth();
  return getWorkspacesRepo(supabase, user.id);
}

export async function createWorkspace(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const { user, supabase } = await requireAuth();
  return createWorkspaceRepo(supabase, user.id, formData);
}

export async function deleteWorkspace(id: string): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();
  return deleteWorkspaceRepo(supabase, user.id, id);
}

export async function togglePublicStatus(
  id: string,
  isPublic: boolean,
): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();
  return togglePublicStatusRepo(supabase, user.id, id, isPublic);
}

export async function setDefaultWorkspace(
  id: string,
): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();
  return setDefaultWorkspaceRepo(supabase, user.id, id);
}

export async function toggleAutoCheckBroken(
  id: string,
  enabled: boolean,
): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();
  return toggleAutoCheckBrokenRepo(supabase, user.id, id, enabled);
}

export async function renameWorkspace(
  id: string,
  name: string,
): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();
  return renameWorkspaceRepo(supabase, user.id, id, name);
}
