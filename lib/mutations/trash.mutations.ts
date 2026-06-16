import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  emptyTrash,
  permanentDeleteBookmarks,
  permanentDeleteWorkspace,
  restoreBookmarks,
  restoreWorkspace,
} from "~/app/action/trash.action";
import { logger } from "~/lib/logger";
import { bookmarkKeys, trashKeys, workspaceKeys } from "~/lib/query-keys";
import type { BookmarkRestoreInput } from "~/lib/schemas/bookmark.schema";

export function useRestoreBookmarks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BookmarkRestoreInput) => restoreBookmarks(input),
    onError: (error) => {
      logger.error("restoreBookmarks failed", { error });
      toast.error("Failed to restore bookmarks");
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trashKeys.all });
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
    },
  });
}

export function useRestoreWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => restoreWorkspace(id),
    onError: (error) => {
      logger.error("restoreWorkspace failed", { error });
      toast.error("Failed to restore workspace");
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trashKeys.all });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
    },
  });
}

export function usePermanentDeleteBookmarks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => permanentDeleteBookmarks(ids),
    onError: (error) => {
      logger.error("permanentDeleteBookmarks failed", { error });
      toast.error("Failed to permanently delete bookmarks");
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Bookmarks permanently deleted");
      } else {
        toast.error(result.error ?? "Failed to permanently delete bookmarks");
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trashKeys.all });
    },
  });
}

export function usePermanentDeleteWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => permanentDeleteWorkspace(id),
    onError: (error) => {
      logger.error("permanentDeleteWorkspace failed", { error });
      toast.error("Failed to permanently delete workspace");
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Workspace permanently deleted");
      } else {
        toast.error(result.error ?? "Failed to permanently delete workspace");
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trashKeys.all });
    },
  });
}

export function useEmptyTrash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => emptyTrash(),
    onError: (error) => {
      logger.error("emptyTrash failed", { error });
      toast.error("Failed to empty trash");
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Trash emptied");
      } else {
        toast.error(result.error ?? "Failed to empty trash");
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trashKeys.all });
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}
