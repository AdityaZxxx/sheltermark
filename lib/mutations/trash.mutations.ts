import { toast } from "sonner";

import type {
  Bookmark,
  BookmarkRestoreInput,
} from "~/lib/schemas/bookmark.schema";
import type { TrashedWorkspace } from "~/lib/schemas/workspace.schema";

import {
  emptyTrash,
  permanentDeleteBookmarks,
  permanentDeleteWorkspace,
  restoreBookmarks,
  restoreWorkspace,
} from "~/app/action/trash.action";
import {
  optimisticRemove,
  typedUpdate,
  useOptimisticMutation,
} from "~/lib/mutations/base";
import { bookmarkKeys, trashKeys, workspaceKeys } from "~/lib/query-keys";

interface RestoreResult {
  restoredCount: number;
  skippedCount: number;
}

function trashedWorkspaceFilterUpdates(
  userId: string,
  restoredIds: readonly string[],
) {
  const idSet = new Set(restoredIds);
  return [
    typedUpdate<TrashedWorkspace[]>(trashKeys.workspaces(userId), (oldData) => {
      const prev = oldData ?? [];
      return prev.map((ws) => ({
        ...ws,
        bookmarks: ws.bookmarks.filter((b) => !idSet.has(b.id)),
      }));
    }),
  ];
}

export function useRestoreBookmarks(userId: string) {
  return useOptimisticMutation<BookmarkRestoreInput, RestoreResult, Bookmark[]>(
    {
      mutationFn: restoreBookmarks,
      mutationKey: ["restoreBookmarks"],
      queryKey: trashKeys.bookmarks(userId),
      dependentQueryKeys: [bookmarkKeys.all(userId)],
      successMessage: null,
      errorMessage: "Failed to restore bookmarks",
      prepareOptimisticData: (oldData, { ids }) => {
        return optimisticRemove(oldData, ids);
      },
      additionalOptimisticUpdates: ({ ids }) =>
        trashedWorkspaceFilterUpdates(userId, ids),
      onSuccessData: (data) => {
        const { restoredCount, skippedCount } = data;
        if (restoredCount > 0 && skippedCount > 0) {
          toast.success(
            `${restoredCount} restored, ${skippedCount} already exists`,
          );
        } else if (restoredCount > 0) {
          toast.success("Bookmarks restored");
        } else if (skippedCount > 0) {
          toast.info("Bookmarks already exist in target workspace");
        }
      },
    },
  );
}

export function useRestoreWorkspace(userId: string) {
  return useOptimisticMutation<string, RestoreResult, TrashedWorkspace[]>({
    mutationFn: restoreWorkspace,
    mutationKey: ["restoreWorkspace"],
    queryKey: trashKeys.workspaces(userId),
    dependentQueryKeys: [workspaceKeys.all(userId), bookmarkKeys.all(userId)],
    successMessage: null,
    errorMessage: "Failed to restore workspace",
    prepareOptimisticData: (oldData, id) => {
      const prev = oldData ?? [];
      return prev.filter((ws) => ws.id !== id);
    },
    onSuccessData: (data) => {
      const { restoredCount, skippedCount } = data;
      if (restoredCount > 0 && skippedCount > 0) {
        toast.success(
          `Workspace restored, ${skippedCount} bookmark${skippedCount !== 1 ? "s" : ""} already exist`,
        );
      } else if (restoredCount > 0 || skippedCount === 0) {
        toast.success("Workspace restored");
      } else {
        toast.info("All bookmarks already exist in workspace");
      }
    },
  });
}

export function usePermanentDeleteBookmarks(userId: string) {
  return useOptimisticMutation<string[], null, Bookmark[]>({
    mutationFn: permanentDeleteBookmarks,
    mutationKey: ["permanentDeleteBookmarks"],
    queryKey: trashKeys.bookmarks(userId),
    successMessage: "Bookmarks permanently deleted",
    errorMessage: "Failed to permanently delete bookmarks",
    prepareOptimisticData: (oldData, ids) => {
      return optimisticRemove(oldData, ids);
    },
    additionalOptimisticUpdates: (ids) =>
      trashedWorkspaceFilterUpdates(userId, ids),
  });
}

export function usePermanentDeleteWorkspace(userId: string) {
  return useOptimisticMutation<string, null, TrashedWorkspace[]>({
    mutationFn: permanentDeleteWorkspace,
    mutationKey: ["permanentDeleteWorkspace"],
    queryKey: trashKeys.workspaces(userId),
    successMessage: "Workspace permanently deleted",
    errorMessage: "Failed to permanently delete workspace",
    prepareOptimisticData: (oldData, id) => {
      return optimisticRemove(oldData, id);
    },
  });
}

export function useEmptyTrash(userId: string) {
  return useOptimisticMutation<void, null, Bookmark[]>({
    mutationFn: () => emptyTrash(),
    mutationKey: ["emptyTrash"],
    queryKey: trashKeys.bookmarks(userId),
    dependentQueryKeys: [bookmarkKeys.all(userId), workspaceKeys.all(userId)],
    successMessage: "Trash emptied",
    errorMessage: "Failed to empty trash",
    prepareOptimisticData: () => {
      return [];
    },
    additionalOptimisticUpdates: () => [
      typedUpdate<TrashedWorkspace[]>(trashKeys.workspaces(userId), () => []),
    ],
  });
}
