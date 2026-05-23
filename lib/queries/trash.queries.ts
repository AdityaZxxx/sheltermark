import type { Bookmark } from "~/lib/schemas/bookmark.schema";
import type { TrashedWorkspace } from "~/lib/schemas/workspace.schema";

import {
  getTrashedBookmarks,
  getTrashedWorkspaces,
} from "~/app/action/trash.action";
import { trashKeys } from "~/lib/query-keys";

export const trashedBookmarksQueryOptions = (userId: string | undefined) => ({
  queryKey: trashKeys.bookmarks,
  queryFn: async () => {
    const result = await getTrashedBookmarks();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  enabled: !!userId,
  refetchOnMount: false,
  placeholderData: (previousData: Bookmark[] | undefined) => previousData,
});

export const trashedWorkspacesQueryOptions = (userId: string | undefined) => ({
  queryKey: trashKeys.workspaces,
  queryFn: async () => {
    const result = await getTrashedWorkspaces();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  enabled: !!userId,
  refetchOnMount: false,
  placeholderData: (previousData: TrashedWorkspace[] | undefined) =>
    previousData,
});
