import { toast } from "sonner";
import {
  emptyTrash,
  permanentDeleteBookmarks,
  permanentDeleteWorkspace,
  restoreBookmarks,
  restoreWorkspace,
} from "~/app/action/trash.action";
import { useOptimisticMutation } from "~/lib/mutations/base";
import { bookmarkKeys, trashKeys, workspaceKeys } from "~/lib/query-keys";
import type {
  Bookmark,
  BookmarkRestoreInput,
} from "~/lib/schemas/bookmark.schema";
import type { TrashedWorkspace } from "~/lib/schemas/workspace.schema";

interface RestoreResult {
  restoredCount: number;
  skippedCount: number;
}

export function useRestoreBookmarks() {
  return useOptimisticMutation<BookmarkRestoreInput, RestoreResult>({
    mutationFn: restoreBookmarks,
    mutationKey: ["restoreBookmarks"],
    queryKey: trashKeys.bookmarks,
    dependentQueryKeys: [bookmarkKeys.all],
    successMessage: null,
    errorMessage: "Failed to restore bookmarks",
    prepareOptimisticData: (oldData, { ids }) => {
      const prev = (oldData as Bookmark[]) ?? [];
      const idSet = new Set(ids);
      return prev.filter((b) => !idSet.has(b.id));
    },
    additionalOptimisticUpdates: ({ ids }) => {
      const idSet = new Set(ids);
      return [
        {
          key: trashKeys.workspaces,
          updater: (oldData) => {
            const prev = (oldData as TrashedWorkspace[]) ?? [];
            return prev.map((ws) => ({
              ...ws,
              bookmarks: ws.bookmarks.filter((b) => !idSet.has(b.id)),
            }));
          },
        },
      ];
    },
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
  });
}

export function useRestoreWorkspace() {
  return useOptimisticMutation<string, RestoreResult>({
    mutationFn: restoreWorkspace,
    mutationKey: ["restoreWorkspace"],
    queryKey: trashKeys.workspaces,
    dependentQueryKeys: [workspaceKeys.all, bookmarkKeys.all],
    successMessage: null,
    errorMessage: "Failed to restore workspace",
    prepareOptimisticData: (oldData, id) => {
      const prev = (oldData as TrashedWorkspace[]) ?? [];
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
  return useOptimisticMutation<string[], null>({
    mutationFn: permanentDeleteBookmarks,
    mutationKey: ["permanentDeleteBookmarks"],
    queryKey: trashKeys.bookmarks,
    successMessage: "Bookmarks permanently deleted",
    errorMessage: "Failed to permanently delete bookmarks",
    prepareOptimisticData: (oldData, ids) => {
      const prev = (oldData as Bookmark[]) ?? [];
      const idSet = new Set(ids);
      return prev.filter((b) => !idSet.has(b.id));
    },
    additionalOptimisticUpdates: (ids) => {
      const idSet = new Set(ids);
      return [
        {
          key: trashKeys.workspaces,
          updater: (oldData) => {
            const prev = (oldData as TrashedWorkspace[]) ?? [];
            return prev.map((ws) => ({
              ...ws,
              bookmarks: ws.bookmarks.filter((b) => !idSet.has(b.id)),
            }));
          },
        },
      ];
    },
  });
}

export function usePermanentDeleteWorkspace() {
  return useOptimisticMutation<string, null>({
    mutationFn: permanentDeleteWorkspace,
    mutationKey: ["permanentDeleteWorkspace"],
    queryKey: trashKeys.workspaces,
    successMessage: "Workspace permanently deleted",
    errorMessage: "Failed to permanently delete workspace",
    prepareOptimisticData: (oldData, id) => {
      const prev = (oldData as TrashedWorkspace[]) ?? [];
      return prev.filter((ws) => ws.id !== id);
    },
  });
}

export function useEmptyTrash() {
  return useOptimisticMutation<void, null>({
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
      {
        key: trashKeys.workspaces,
        updater: () => [],
      },
    ],
  });
}
