import type { ActionResult } from "~/lib/action-result";
import type { WorkspaceWithBookmarks } from "~/lib/schemas/bookmark.schema";
import type { Profile } from "~/lib/schemas/profile.schema";

import { requireAuthSafe } from "~/lib/auth";
import { getDb } from "~/lib/data/db";
import {
  getProfileDisplayName as repoGetProfileDisplayName,
  getPublicProfile as repoGetPublicProfile,
} from "~/lib/data/repositories/profile.repository";

export async function getProfileDisplayName(username: {
  username: string;
}): Promise<ActionResult<string | null>> {
  await requireAuthSafe();
  return repoGetProfileDisplayName(getDb(), username);
}

export async function getPublicProfile(
  username: string,
): Promise<
  ActionResult<{ profile?: Profile; workspaces: WorkspaceWithBookmarks[] }>
> {
  await requireAuthSafe();
  return repoGetPublicProfile(getDb(), username);
}
