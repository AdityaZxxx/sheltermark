import type { Bookmark } from "~/lib/schemas/bookmark.schema";
import type { TrashedWorkspace } from "~/lib/schemas/workspace.schema";

import {
  getTrashedBookmarks,
  getTrashedWorkspaces,
} from "~/app/action/trash.action";
import { trashKeys } from "~/lib/query-keys";

export const trashedBookmarksQueryOptions = (userId: string) => ({
  queryKey: trashKeys.bookmarks(userId),
  queryFn: async () => {
    const result = await getTrashedBookmarks();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  refetchOnMount: false,
  placeholderData: (previousData: Bookmark[] | undefined) => previousData,
});

export const trashedWorkspacesQueryOptions = (userId: string) => ({
  queryKey: trashKeys.workspaces(userId),
  queryFn: async () => {
    const result = await getTrashedWorkspaces();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  refetchOnMount: false,
  placeholderData: (previousData: TrashedWorkspace[] | undefined) =>
    previousData,
});
