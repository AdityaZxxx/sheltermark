import type { ActionResult } from "~/lib/action-result";
import type { WorkspaceWithBookmarks } from "~/lib/schemas/bookmark.schema";
import type { Profile } from "~/lib/schemas/profile.schema";

import { requireAuthSafe } from "~/lib/auth";
import {
  getProfileDisplayName as repoGetProfileDisplayName,
  getPublicProfile as repoGetPublicProfile,
} from "~/lib/data/repositories/profile.repository";

export async function getProfileDisplayName(username: {
  username: string;
}): Promise<ActionResult<string | null>> {
  const { supabase } = await requireAuthSafe();
  return repoGetProfileDisplayName(supabase, username);
}

export async function getPublicProfile(
  username: string,
): Promise<
  ActionResult<{ profile?: Profile; workspaces: WorkspaceWithBookmarks[] }>
> {
  // Basic guard remains: if username invalid structure, repository will validate as well
  const { supabase } = await requireAuthSafe();
  return repoGetPublicProfile(supabase, username);
}
