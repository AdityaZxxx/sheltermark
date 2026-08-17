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

function trashedWorkspaceFilterUpdates(restoredIds: readonly string[]) {
  const idSet = new Set(restoredIds);
  return [
    typedUpdate<TrashedWorkspace[]>(trashKeys.workspaces, (oldData) => {
      const prev = oldData ?? [];
      return prev.map((ws) => ({
        ...ws,
        bookmarks: ws.bookmarks.filter((b) => !idSet.has(b.id)),
      }));
    }),
  ];
}

export function useRestoreBookmarks() {
  return useOptimisticMutation<BookmarkRestoreInput, RestoreResult, Bookmark[]>(
    {
      mutationFn: restoreBookmarks,
      mutationKey: ["restoreBookmarks"],
      queryKey: trashKeys.bookmarks,
      dependentQueryKeys: [bookmarkKeys.all],
      successMessage: null,
      errorMessage: "Failed to restore bookmarks",
      prepareOptimisticData: (oldData, { ids }) => {
        return optimisticRemove(oldData, ids);
      },
      additionalOptimisticUpdates: ({ ids }) =>
        trashedWorkspaceFilterUpdates(ids),
      onSuccess: (result) => {
        if (result.success) {
          const { restoredCount, skippedCount } = result.data;
          if (restoredCount > 0 && skippedCount > 0) {
            toast.success(
              `${restoredCount} restored, ${skippedCount} already exists`,
            );
          } else if (restoredCount > 0) {
            toast.success("Bookmarks restored");
          } else if (skippedCount > 0) {
            toast.info("Bookmarks already exist in target workspace");
          }
        } else {
          toast.error(result.error ?? "Failed to restore bookmarks");
        }
      },
    },
  );
}

export function useRestoreWorkspace() {
  return useOptimisticMutation<string, RestoreResult, TrashedWorkspace[]>({
    mutationFn: restoreWorkspace,
    mutationKey: ["restoreWorkspace"],
    queryKey: trashKeys.workspaces,
    dependentQueryKeys: [workspaceKeys.all, bookmarkKeys.all],
    successMessage: null,
    errorMessage: "Failed to restore workspace",
    prepareOptimisticData: (oldData, id) => {
      const prev = oldData ?? [];
      return prev.filter((ws) => ws.id !== id);
    },
    onSuccess: (result) => {
      if (result.success) {
        const { restoredCount, skippedCount } = result.data;
        if (restoredCount > 0 && skippedCount > 0) {
          toast.success(
            `Workspace restored, ${skippedCount} bookmark${skippedCount !== 1 ? "s" : ""} already exist`,
          );
        } else if (restoredCount > 0 || skippedCount === 0) {
          toast.success("Workspace restored");
        } else {
          toast.info("All bookmarks already exist in workspace");
        }
      } else {
        toast.error(result.error ?? "Failed to restore workspace");
      }
    },
  });
}

export function usePermanentDeleteBookmarks() {
  return useOptimisticMutation<string[], null, Bookmark[]>({
    mutationFn: permanentDeleteBookmarks,
    mutationKey: ["permanentDeleteBookmarks"],
    queryKey: trashKeys.bookmarks,
    successMessage: "Bookmarks permanently deleted",
    errorMessage: "Failed to permanently delete bookmarks",
    prepareOptimisticData: (oldData, ids) => {
      return optimisticRemove(oldData, ids);
    },
    additionalOptimisticUpdates: (ids) => trashedWorkspaceFilterUpdates(ids),
  });
}

export function usePermanentDeleteWorkspace() {
  return useOptimisticMutation<string, null, TrashedWorkspace[]>({
    mutationFn: permanentDeleteWorkspace,
    mutationKey: ["permanentDeleteWorkspace"],
    queryKey: trashKeys.workspaces,
    successMessage: "Workspace permanently deleted",
    errorMessage: "Failed to permanently delete workspace",
    prepareOptimisticData: (oldData, id) => {
      return optimisticRemove(oldData, id);
    },
  });
}

export function useEmptyTrash() {
  return useOptimisticMutation<void, null, Bookmark[]>({
    mutationFn: () => emptyTrash(),
    mutationKey: ["emptyTrash"],
    queryKey: trashKeys.bookmarks,
    dependentQueryKeys: [bookmarkKeys.all, workspaceKeys.all],
    successMessage: "Trash emptied",
    errorMessage: "Failed to empty trash",
    prepareOptimisticData: () => {
      // Clear bookmarks list optimistically
      return [];
    },
    additionalOptimisticUpdates: () => [
      typedUpdate<TrashedWorkspace[]>(trashKeys.workspaces, () => []),
    ],
  });
}
