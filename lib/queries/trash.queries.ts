import {
  getTrashedBookmarks,
  getTrashedWorkspaces,
} from "~/app/action/trash.action";
import { trashKeys } from "~/lib/query-keys";
import type { Bookmark } from "~/lib/schemas/bookmark.schema";
import type { TrashedWorkspace } from "~/lib/schemas/workspace.schema";

export const trashedBookmarksQueryOptions = (userId: string | undefined) => ({
  queryKey: trashKeys.bookmarks,
  queryFn: async () => {
    const result = await getTrashedBookmarks();
    if (!result?.success) throw new Error(result?.error);
    return result.data as Bookmark[];
  },
  enabled: !!userId,
});

export const trashedWorkspacesQueryOptions = (userId: string | undefined) => ({
  queryKey: trashKeys.workspaces,
  queryFn: async () => {
    const result = await getTrashedWorkspaces();
    if (!result?.success) throw new Error(result?.error);
    return result.data as TrashedWorkspace[];
  },
  enabled: !!userId,
});
