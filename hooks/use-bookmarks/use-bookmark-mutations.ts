"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addBookmark as addBookmarkAction,
  deleteBookmarks as deleteBookmarksAction,
  moveBookmarks as moveBookmarksAction,
  refetchBookmarkMetadata as refetchBookmarkMetadataAction,
  renameBookmark as renameBookmarkAction,
} from "~/app/action/bookmark";
import { useSupabase } from "~/components/providers/supabase-provider";
import { bookmarkKeys, workspaceKeys } from "~/lib/query-keys";
import type {
  Bookmark,
  BookmarkDeleteInput,
  BookmarkMoveInput,
  BookmarkRefetchMetadataInput,
  BookmarkRenameInput,
} from "~/lib/schemas/bookmark";

const generateTempId = () =>
  `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function useBookmarkMutations() {
  const queryClient = useQueryClient();
  const { user } = useSupabase();

  const addBookmarkMut = useMutation({
    mutationFn: (data: { url: string; workspaceId: string }) =>
      addBookmarkAction(data),
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
        is_public: false,
        favicon_url: null,
        og_image_url: null,
        workspace_id: data.workspaceId,
        user_id: user?.id || "",
        updated_at: null,
        created_at: new Date().toISOString(),
      } as Bookmark;

      queryClient.setQueryData<Bookmark[]>(bookmarkKeys.all, (old = []) => [
        optimisticBookmark,
        ...old,
      ]);

      return { previousBookmarks };
    },
    onError: (error, _variables, context) => {
      console.error("[useBookmarks] addBookmark failed:", error);
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

  const deleteBookmarksMut = useMutation({
    mutationFn: deleteBookmarksAction,
    onMutate: async ({ ids }: BookmarkDeleteInput) => {
      await queryClient.cancelQueries({ queryKey: bookmarkKeys.all });
      const previousBookmarks = queryClient.getQueryData<Bookmark[]>(
        bookmarkKeys.all,
      );

      const idsToDelete = new Set(ids);
      queryClient.setQueryData<Bookmark[]>(bookmarkKeys.all, (old = []) =>
        old.filter((b) => !idsToDelete.has(b.id)),
      );

      return { previousBookmarks };
    },
    onError: (error, _variables, context) => {
      console.error("[useBookmarks] deleteBookmarks failed:", error);
      if (context?.previousBookmarks) {
        queryClient.setQueryData(bookmarkKeys.all, context.previousBookmarks);
      }
      toast.error("Failed to delete bookmarks");
    },
    onSuccess: (data) => {
      if (!data?.success) {
        toast.error(data.error ?? "Failed to delete bookmarks");
      } else {
        toast.success("Bookmarks deleted");
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
    },
  });

  const renameBookmarkMut = useMutation({
    mutationFn: async ({ id, title }: BookmarkRenameInput) => {
      return renameBookmarkAction({ id, title });
    },
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: bookmarkKeys.all });
      const previousBookmarks = queryClient.getQueryData<Bookmark[]>(
        bookmarkKeys.all,
      );

      queryClient.setQueryData<Bookmark[]>(bookmarkKeys.all, (old = []) =>
        old.map((b) => (b.id === id ? { ...b, title } : b)),
      );

      return { previousBookmarks };
    },
    onError: (error, _variables, context) => {
      console.error("[useBookmarks] renameBookmark failed:", error);
      if (context?.previousBookmarks) {
        queryClient.setQueryData(bookmarkKeys.all, context.previousBookmarks);
      }
      toast.error("Failed to rename bookmark");
    },
    onSuccess: (result) => {
      if (!result?.success) {
        toast.error(result.error ?? "Failed to rename bookmark");
      } else {
        toast.success("Bookmark renamed");
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
    },
  });

  const moveBookmarksMut = useMutation({
    mutationFn: async ({ ids, targetWorkspaceId }: BookmarkMoveInput) => {
      return moveBookmarksAction({ ids, targetWorkspaceId });
    },
    onMutate: async ({ ids, targetWorkspaceId }) => {
      await queryClient.cancelQueries({ queryKey: bookmarkKeys.all });
      const previousBookmarks = queryClient.getQueryData<Bookmark[]>(
        bookmarkKeys.all,
      );

      const idsToMove = new Set(ids);
      const movedBookmarks: Bookmark[] = [];

      queryClient.setQueryData<Bookmark[]>(bookmarkKeys.all, (old = []) =>
        old.filter((b) => {
          if (idsToMove.has(b.id)) {
            movedBookmarks.push({ ...b, workspace_id: targetWorkspaceId });
            return false;
          }
          return true;
        }),
      );

      return { previousBookmarks };
    },
    onError: (error, _variables, context) => {
      console.error("[useBookmarks] moveBookmarks failed:", error);
      if (context?.previousBookmarks) {
        queryClient.setQueryData(bookmarkKeys.all, context.previousBookmarks);
      }
      toast.error("Failed to move bookmarks");
    },
    onSuccess: (result) => {
      if (!result?.success) {
        toast.error(result.error ?? "Failed to move bookmarks");
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.byUser(user.id),
        });
      }
    },
  });

  const refetchBookmarkMetadataMut = useMutation({
    mutationFn: ({ id }: BookmarkRefetchMetadataInput) =>
      refetchBookmarkMetadataAction({ id }),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: bookmarkKeys.all });
      const previousBookmarks = queryClient.getQueryData<Bookmark[]>(
        bookmarkKeys.all,
      );
      queryClient.setQueryData<Bookmark[]>(bookmarkKeys.all, (old = []) =>
        old.map((b) =>
          b.id === id ? { ...b, last_checked_at: new Date().toISOString() } : b,
        ),
      );
      return { previousBookmarks };
    },
    onError: (error, _variables, context) => {
      console.error("[useBookmarks] refetchBookmarkMetadata failed:", error);
      if (context?.previousBookmarks) {
        queryClient.setQueryData(bookmarkKeys.all, context.previousBookmarks);
      }
      toast.error("Failed to refresh metadata");
    },
    onSuccess: (result) => {
      if (!result?.success) {
        toast.error(result.error ?? "Failed to refresh metadata");
      } else {
        toast.success("Metadata refreshed");
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
    },
  });

  return {
    addBookmark: addBookmarkMut.mutate,
    isAddingBookmark: addBookmarkMut.isPending,
    deleteBookmarks: deleteBookmarksMut.mutate,
    isDeletingBookmarks: deleteBookmarksMut.isPending,
    renameBookmark: renameBookmarkMut.mutate,
    isRenamingBookmark: renameBookmarkMut.isPending,
    moveBookmarks: moveBookmarksMut.mutate,
    isMovingBookmarks: moveBookmarksMut.isPending,
    refetchBookmarkMetadata: refetchBookmarkMetadataMut.mutate,
    isRefetchingMetadata: refetchBookmarkMetadataMut.isPending,
  };
}
