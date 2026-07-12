"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { Bookmark } from "~/types/bookmark.types";

const generateTempId = () =>
  `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const bookmarksQueryOptions = (
  workspaceId: string | undefined,
  userId: string | undefined,
) => ({
  queryKey: bookmarkKeys.byWorkspace(workspaceId, userId),
  queryFn: async () => {
    const { data, error } = await getBookmarks();
    if (error) throw new Error(error);
    return data || [];
  },
  enabled: !!userId,
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 30,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
});

export function useBookmarks(workspaceId?: string) {
  const queryClient = useQueryClient();
  const { supabase, user, isLoading: isAuthLoading } = useSupabase();
  const [searchQuery, setSearchQuery] = useState("");

  const queryKey = useMemo(
    () => bookmarkKeys.byWorkspace(workspaceId, user?.id),
    [workspaceId, user?.id],
  );

  const { data: allBookmarks = [], isLoading } = useQuery<Bookmark[]>(
    bookmarksQueryOptions(workspaceId, user?.id),
  );

  const bookmarks = useMemo(() => {
    if (!workspaceId) return allBookmarks;
    return allBookmarks.filter((b) => b.workspace_id === workspaceId);
  }, [allBookmarks, workspaceId]);

  const filteredBookmarks = useMemo(() => {
    if (!searchQuery.trim()) return bookmarks;
    const query = searchQuery.toLowerCase();
    return bookmarks.filter(
      (b) =>
        b.title?.toLowerCase().includes(query) ||
        b.url.toLowerCase().includes(query) ||
        b.domain?.toLowerCase().includes(query),
    );
  }, [bookmarks, searchQuery]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const invalidateAllBookmarks = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
  }, [queryClient]);

  const _invalidateWorkspaces = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: workspaceKeys.byUser(user?.id),
    });
  }, [queryClient, user?.id]);

  useEffect(() => {
    if (!user?.id || !supabase) return;

    const channel = supabase
      .channel("bookmarks-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bookmarks",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log("[useBookmarks] New bookmark detected");
          queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
          toast.success("New bookmark added!");
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, supabase, queryClient]);

  const addBookmark = useMutation({
    mutationFn: addBookmarkAction,
    onMutate: async (formData: FormData) => {
      await queryClient.cancelQueries({ queryKey });
      const previousBookmarks = queryClient.getQueryData(queryKey);

      const url = formData.get("url") as string;
      const title = (formData.get("title") as string) || url;
      const domain = formData.get("domain") as string;
      const workspaceIdValue = formData.get("workspaceId") as string;

      const tempId = generateTempId();
      const optimisticBookmark: Bookmark = {
        id: tempId,
        url,
        title,
        domain: domain || "",
        favicon_url: null,
        og_image_url: null,
        workspace_id: workspaceIdValue || null,
        user_id: user?.id || "",
        created_at: new Date().toISOString(),
        updated_at: null,
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
      if (data.success) {
        toast.success("Bookmark added");
      }
    },
    onSettled: () => {
      invalidate();
    },
  });

  const deleteBookmarks = useMutation({
    mutationFn: deleteBookmarksAction,
    onMutate: async (ids: string[]) => {
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
      if (data.success) {
        toast.success("Bookmarks deleted");
      }
    },
    onSettled: () => {
      invalidate();
    },
  });

  const renameBookmark = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      return renameBookmarkAction(id, title);
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
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Bookmark renamed");
      }
    },
    onSettled: () => {
      invalidate();
    },
  });

  const moveBookmarks = useMutation({
    mutationFn: async ({
      ids,
      targetWorkspaceId,
    }: {
      ids: string[];
      targetWorkspaceId: string;
    }) => {
      return moveBookmarksAction(ids, targetWorkspaceId);
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
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Bookmarks moved");
      }
    },
    onSettled: () => {
      invalidate();
      invalidateAllBookmarks();
      queryClient.invalidateQueries({ queryKey: ["workspaces", user?.id] });
    },
  });

  const refetchBookmarkMetadata = useMutation({
    mutationFn: ({ id }: { id: string }) => refetchBookmarkMetadataAction(id),
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
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Metadata refreshed");
      }
    },
    onSettled: () => {
      invalidate();
    },
  });

  return {
    bookmarks,
    filteredBookmarks,
    allBookmarks,
    isLoading: isAuthLoading || isLoading,
    searchQuery,
    setSearchQuery,
    invalidate,
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
