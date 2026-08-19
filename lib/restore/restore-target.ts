import type { Bookmark } from "~/lib/schemas/bookmark.schema";
import type {
  TrashedWorkspace,
  WorkspaceWithCount,
} from "~/lib/schemas/workspace.schema";

export type RestoreTarget = {
  ids: string[];
  hasTrashedOrigin: boolean;
  trashedWorkspaceName: string | null;
  trashedWorkspaceId: string | null;
  originalWorkspaceName: string | null;
};

export function getRestoreTargetForUI(
  ids: string[],
  trashedBookmarks: Bookmark[],
  trashedWorkspaces: TrashedWorkspace[],
  activeWorkspaces: WorkspaceWithCount[],
): RestoreTarget {
  const trashedBookmarkIdsFromWs = new Set(
    trashedWorkspaces.flatMap((ws) => ws.bookmarks.map((bm) => bm.id)),
  );

  const trashedBookmarkToWs = new Map<string, { id: string; name: string }>();
  for (const ws of trashedWorkspaces) {
    for (const bm of ws.bookmarks) {
      trashedBookmarkToWs.set(bm.id, { id: ws.id, name: ws.name });
    }
  }

  const hasTrashedOrigin = ids.some((id) => trashedBookmarkIdsFromWs.has(id));

  let trashedWorkspaceName: string | null = null;
  let trashedWorkspaceId: string | null = null;

  if (hasTrashedOrigin) {
    for (const id of ids) {
      const ws = trashedBookmarkToWs.get(id);
      if (ws) {
        trashedWorkspaceName = ws.name;
        trashedWorkspaceId = ws.id;
        break;
      }
    }
  }

  let originalWorkspaceName: string | null = null;
  if (!hasTrashedOrigin && ids.length > 0) {
    const bm = trashedBookmarks.find((b) => b.id === ids[0]);
    if (bm?.workspace_id) {
      const ws = activeWorkspaces.find((w) => w.id === bm.workspace_id);
      if (ws) originalWorkspaceName = ws.name;
    }
  }

  return {
    ids,
    hasTrashedOrigin,
    trashedWorkspaceName,
    trashedWorkspaceId,
    originalWorkspaceName,
  };
}
