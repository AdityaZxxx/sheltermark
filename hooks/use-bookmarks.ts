"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  addBookmark as addBookmarkAction,
  deleteBookmarks as deleteBookmarksAction,
  getBookmarks,
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
  BookmarkSort,
} from "~/lib/schemas/bookmark";

const generateTempId = () =>
  `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const DEFAULT_SORT: BookmarkSort = { sortBy: "created_at", sortOrder: "desc" };

const bookmarksQueryOptions = (userId: string | undefined) => ({
  queryKey: bookmarkKeys.all,
  queryFn: async () => {
    const result = await getBookmarks();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  enabled: !!userId,
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 30,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
});

export function useBookmarks(workspaceId?: string) {
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useSupabase();
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<BookmarkSort>(DEFAULT_SORT);

  const queryKey = bookmarkKeys.all;

  const { data: allBookmarks = [], isLoading } = useQuery<Bookmark[]>(
    bookmarksQueryOptions(user?.id),
  );

  const filteredBookmarks = workspaceId
    ? allBookmarks.filter((b) => b.workspace_id === workspaceId)
    : allBookmarks;

  const searchedBookmarks = searchQuery.trim()
    ? filteredBookmarks.filter(
        (b) =>
          b.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.url.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : filteredBookmarks;

  const bookmarks = [...searchedBookmarks].sort((a, b) => {
    const asc = sort.sortOrder === "asc";
    const cmp = (x: string, y: string) =>
      asc ? x.localeCompare(y) : y.localeCompare(x);

    switch (sort.sortBy) {
      case "title":
        return cmp(a.title || "", b.title || "");
      case "domain":
        return cmp(a.url, b.url);
      case "updated_at":
        return cmp(a.updated_at || "", b.updated_at || "");
      default:
        return cmp(a.created_at, b.created_at);
    }
  });

  const invalidateBookmarks = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  const invalidateAllBookmarks = () => {
    queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
  };

  const invalidateWorkspaces = () => {
    queryClient.invalidateQueries({
      queryKey: workspaceKeys.byUser(user?.id),
    });
  };

  const addBookmark = useMutation({
    mutationFn: (data: { url: string; workspaceId: string }) =>
      addBookmarkAction(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey });
      const previousBookmarks = queryClient.getQueryData(queryKey);

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
      };

      queryClient.setQueryData(queryKey, (old: Bookmark[] = []) => [
        optimisticBookmark,
        ...old,
      ]);

      return { previousBookmarks };
    },
    onError: (error, _variables, context) => {
      console.error("[useBookmarks] addBookmark failed:", error);
      if (context?.previousBookmarks) {
        queryClient.setQueryData(queryKey, context.previousBookmarks);
      }
      toast.error("Failed to add bookmark");
    },
    onSuccess: (data) => {
      if (!data.success) {
        toast.error(data.error);
      } else {
        toast.success("Bookmark added");
      }
    },
    onSettled: () => {
      invalidateBookmarks();
    },
  });

  const deleteBookmarks = useMutation({
    mutationFn: deleteBookmarksAction,
    onMutate: async ({ ids }: BookmarkDeleteInput) => {
      await queryClient.cancelQueries({ queryKey });
      const previousBookmarks = queryClient.getQueryData(queryKey);

      const idsToDelete = new Set(ids);
      queryClient.setQueryData(queryKey, (old: Bookmark[] = []) =>
        old.filter((b) => !idsToDelete.has(b.id)),
      );

      return { previousBookmarks };
    },
    onError: (error, _variables, context) => {
      console.error("[useBookmarks] deleteBookmarks failed:", error);
      if (context?.previousBookmarks) {
        queryClient.setQueryData(queryKey, context.previousBookmarks);
      }
      toast.error("Failed to delete bookmarks");
    },
    onSuccess: (data) => {
      if (!data.success) {
        toast.error(data.error);
      } else {
        toast.success("Bookmarks deleted");
      }
    },
    onSettled: () => {
      invalidateBookmarks();
    },
  });

  const renameBookmark = useMutation({
    mutationFn: async ({ id, title }: BookmarkRenameInput) => {
      return renameBookmarkAction({ id, title });
    },
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousBookmarks = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: Bookmark[] = []) =>
        old.map((b) => (b.id === id ? { ...b, title } : b)),
      );

      return { previousBookmarks };
    },
    onError: (error, _variables, context) => {
      console.error("[useBookmarks] renameBookmark failed:", error);
      if (context?.previousBookmarks) {
        queryClient.setQueryData(queryKey, context.previousBookmarks);
      }
      toast.error("Failed to rename bookmark");
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error);
      } else {
        toast.success("Bookmark renamed");
      }
    },
    onSettled: () => {
      invalidateBookmarks();
    },
  });

  const moveBookmarks = useMutation({
    mutationFn: async ({ ids, targetWorkspaceId }: BookmarkMoveInput) => {
      return moveBookmarksAction({ ids, targetWorkspaceId });
    },
    onMutate: async ({ ids, targetWorkspaceId }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousBookmarks = queryClient.getQueryData(queryKey);

      const idsToMove = new Set(ids);
      const movedBookmarks: Bookmark[] = [];

      queryClient.setQueryData(queryKey, (old: Bookmark[] = []) =>
        old.filter((b) => {
          if (idsToMove.has(b.id)) {
            movedBookmarks.push({ ...b, workspace_id: targetWorkspaceId });
            return false;
          }
          return true;
        }),
      );

      const targetQueryKey = bookmarkKeys.byWorkspace(
        targetWorkspaceId,
        user?.id,
      );

      queryClient.setQueryData(targetQueryKey, (old: Bookmark[] = []) => [
        ...(old || []),
        ...movedBookmarks,
      ]);

      return { previousBookmarks };
    },
    onError: (error, _variables, context) => {
      console.error("[useBookmarks] moveBookmarks failed:", error);
      if (context?.previousBookmarks) {
        queryClient.setQueryData(queryKey, context.previousBookmarks);
      }
      toast.error("Failed to move bookmarks");
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error);
      }
    },
    onSettled: () => {
      invalidateBookmarks();
      invalidateAllBookmarks();
      invalidateWorkspaces();
    },
  });

  const refetchBookmarkMetadata = useMutation({
    mutationFn: ({ id }: BookmarkRefetchMetadataInput) =>
      refetchBookmarkMetadataAction({ id }),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousBookmarks = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: Bookmark[] = []) =>
        old.map((b) =>
          b.id === id ? { ...b, last_checked_at: new Date().toISOString() } : b,
        ),
      );

      return { previousBookmarks };
    },
    onError: (error, _variables, context) => {
      console.error("[useBookmarks] refetchBookmarkMetadata failed:", error);
      if (context?.previousBookmarks) {
        queryClient.setQueryData(queryKey, context.previousBookmarks);
      }
      toast.error("Failed to refresh metadata");
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error);
      } else {
        toast.success("Metadata refreshed");
      }
    },
    onSettled: () => {
      invalidateBookmarks();
    },
  });

  return {
    bookmarks,
    filteredBookmarks: bookmarks,
    allBookmarks,
    isLoading: isAuthLoading || isLoading,
    searchQuery,
    setSearchQuery,
    sort,
    setSort,
    invalidate: invalidateBookmarks,
    addBookmark: addBookmark.mutate,
    isAddingBookmark: addBookmark.isPending,
    deleteBookmarks: deleteBookmarks.mutate,
    isDeletingBookmarks: deleteBookmarks.isPending,
    renameBookmark: renameBookmark.mutate,
    isRenamingBookmark: renameBookmark.isPending,
    moveBookmarks: moveBookmarks.mutate,
    isMovingBookmarks: moveBookmarks.isPending,
    refetchBookmarkMetadata: refetchBookmarkMetadata.mutate,
    isRefetchingMetadata: refetchBookmarkMetadata.isPending,
  };
}
