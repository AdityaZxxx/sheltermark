"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  addBookmark as addBookmarkAction,
  deleteBookmarks as deleteBookmarksAction,
  getBookmarks,
  moveBookmarks as moveBookmarksAction,
  renameBookmark as renameBookmarkAction,
} from "~/app/action/bookmark";
import { useSupabase } from "~/components/providers/supabase-provider";
import type { Bookmark } from "~/types/bookmark.types";

export function useBookmarks(workspaceId?: string) {
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useSupabase();
  const [searchQuery, setSearchQuery] = useState("");

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
  });

  const bookmarks = useMemo(() => {
    if (!workspaceId) return allBookmarks;
    return allBookmarks.filter((b) => b.workspace_id === workspaceId);
  }, [allBookmarks, workspaceId]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

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

  return {
    bookmarks,
    allBookmarks,
    isLoading: isAuthLoading || isLoading,
    searchQuery,
    setSearchQuery,
    invalidate,
    addBookmark: addBookmark.mutate,
    deleteBookmarks: deleteBookmarks.mutate,
    renameBookmark: renameBookmark.mutate,
    moveBookmarks: moveBookmarks.mutate,
  };
}
