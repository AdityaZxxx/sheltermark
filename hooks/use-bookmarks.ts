"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { Bookmark } from "~/types/bookmark.types";

export function useBookmarks(workspaceId?: string) {
  const queryClient = useQueryClient();
  const { supabase, user, isLoading: isAuthLoading } = useSupabase();
  const [searchQuery, setSearchQuery] = useState("");

  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const queryKey = useMemo(
    () => ["bookmarks", workspaceId, user?.id] as const,
    [workspaceId, user?.id],
  );

  const { data: allBookmarks = [], isLoading } = useQuery<Bookmark[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await getBookmarks();
      if (error) throw new Error(error);
      return data || [];
    },
    enabled: !!user?.id && !isAuthLoading,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

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

  // Realtime subscription - auto-refresh when new bookmark is added from extension
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
          queryClientRef.current.invalidateQueries({ queryKey: ["bookmarks"] });
          toast.success("New bookmark added!");
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, supabase]);

  const addBookmark = useMutation({
    mutationFn: addBookmarkAction,
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        invalidate();
      }
    },
  });

  const deleteBookmarks = useMutation({
    mutationFn: deleteBookmarksAction,
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        invalidate();
      }
    },
  });

  const renameBookmark = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      return renameBookmarkAction(id, title);
    },
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        invalidate();
      }
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
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        invalidate();
      }
    },
  });

  const refetchBookmarkMetadata = useMutation({
    mutationFn: refetchBookmarkMetadataAction,
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        invalidate();
        toast.success("Metadata refreshed");
      }
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
    deleteBookmarks: deleteBookmarks.mutate,
    renameBookmark: renameBookmark.mutate,
    moveBookmarks: moveBookmarks.mutate,
    refetchBookmarkMetadata: refetchBookmarkMetadata.mutate,
  };
}
