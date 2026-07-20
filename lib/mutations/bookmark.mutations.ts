import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addBookmark,
  deleteBookmarks,
  moveBookmarks,
  refetchBookmarkMetadata,
  renameBookmark,
  updateBookmarkNote,
} from "~/app/action/bookmark.action";
import { logger } from "~/lib/logger";
import { useOptimisticMutation } from "~/lib/mutations/base";
import { bookmarkKeys, trashKeys, workspaceKeys } from "~/lib/query-keys";
import type {
  Bookmark,
  BookmarkDeleteInput,
  BookmarkMoveInput,
  BookmarkRenameInput,
  BookmarkUpdateNoteInput,
} from "~/lib/schemas/bookmark.schema";

const generateTempId = () =>
  `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function useAddBookmark(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { url: string; workspaceId: string }) =>
      addBookmark(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: bookmarkKeys.all });
      const previousBookmarks = queryClient.getQueryData<Bookmark[]>(
        bookmarkKeys.all,
      );

      const tempId = generateTempId();
      const optimisticBookmark: Bookmark = {
        id: tempId,
        url: data.url,
        title: data.url,
        http_status: null,
        last_checked_at: null,
        is_broken: false,
        broken_status: "alive",
        is_public: false,
        favicon_url: null,
        og_image_url: null,
        workspace_id: data.workspaceId,
        user_id: userId || "",
        updated_at: null,
        created_at: new Date().toISOString(),
        note: null,
      } as Bookmark;

      queryClient.setQueryData<Bookmark[]>(bookmarkKeys.all, (old = []) => [
        optimisticBookmark,
        ...old,
      ]);

      return { previousBookmarks };
    },
    onError: (error, variables, context) => {
      logger.error("addBookmark failed", { error, variables: variables });
      if (context?.previousBookmarks) {
        queryClient.setQueryData(bookmarkKeys.all, context.previousBookmarks);
      }
      toast.error("Failed to add bookmark");
    },
    onSuccess: (data) => {
      if (!data?.success) {
        toast.error(data.error ?? "Failed to add bookmark");
      } else {
        toast.success("Bookmark added");
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
    },
  });
}

export function useDeleteBookmarks(_userId: string | undefined) {
  return useOptimisticMutation<BookmarkDeleteInput, null>({
    mutationFn: deleteBookmarks,
    queryKey: bookmarkKeys.all,
    dependentQueryKeys: [trashKeys.all],
    successMessage: null,
    errorMessage: "Failed to delete bookmarks",
    prepareOptimisticData: (oldData, { ids }) => {
      const prev = oldData as Bookmark[];
      const idsToDelete = new Set(ids);
      return prev.filter((b) => !idsToDelete.has(b.id));
    },
  });
}

export function useRenameBookmark(_userId: string | undefined) {
  return useOptimisticMutation<BookmarkRenameInput, null>({
    mutationFn: renameBookmark,
    queryKey: bookmarkKeys.all,
    successMessage: "Bookmark renamed",
    errorMessage: "Failed to rename bookmark",
    prepareOptimisticData: (oldData, { id, title }) => {
      const prev = oldData as Bookmark[];
      return prev.map((b) => (b.id === id ? { ...b, title } : b));
    },
  });
}

export function useMoveBookmarks(userId: string | undefined) {
  return useOptimisticMutation<
    BookmarkMoveInput,
    { movedCount: number; skippedCount: number }
  >({
    mutationFn: moveBookmarks,
    queryKey: bookmarkKeys.all,
    dependentQueryKeys: userId ? [workspaceKeys.byUser(userId)] : [],
    successMessage: null,
    errorMessage: "Failed to move bookmarks",
    prepareOptimisticData: (oldData, { ids }) => {
      const prev = oldData as Bookmark[];
      const idsToMove = new Set(ids);
      return prev.filter((b) => !idsToMove.has(b.id));
    },
  });
}

export function useRefetchBookmarkMetadata(_userId: string | undefined) {
  return useOptimisticMutation<{ id: string }, null>({
    mutationFn: refetchBookmarkMetadata,
    queryKey: bookmarkKeys.all,
    successMessage: "Metadata refreshed",
    errorMessage: "Failed to refresh metadata",
    prepareOptimisticData: (oldData, { id }) => {
      const prev = oldData as Bookmark[];
      return prev.map((b) =>
        b.id === id ? { ...b, last_checked_at: new Date().toISOString() } : b,
      );
    },
  });
}

export function useUpdateBookmarkNote(_userId: string | undefined) {
  return useOptimisticMutation<BookmarkUpdateNoteInput, null>({
    mutationFn: updateBookmarkNote,
    queryKey: bookmarkKeys.all,
    successMessage: "Note saved",
    errorMessage: "Failed to save note",
    prepareOptimisticData: (oldData, { id, note }) => {
      const prev = oldData as Bookmark[];
      return prev.map((b) => (b.id === id ? { ...b, note } : b));
    },
  });
}
