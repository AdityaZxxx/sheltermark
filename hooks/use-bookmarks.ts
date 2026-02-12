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

export interface Bookmark {
  id: string;
  user_id: string;
  workspace_id: string | null;
  url: string;
  title: string | null;
  favicon_url: string | null;
  og_image_url: string | null;
  domain?: string;
  created_at: string;
  updated_at: string | null;
}

export function useBookmarks(workspaceId?: string | null) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: bookmarks = [], isLoading } = useQuery<Bookmark[]>({
    queryKey: ["bookmarks", workspaceId],
    queryFn: async () => {
      const { data, error } = await getBookmarks(workspaceId);
      if (error) throw new Error(error);
      return data as Bookmark[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    queryClient.invalidateQueries({ queryKey: ["workspaces"] });
  };

  const deleteMutation = useMutation({
    mutationFn: deleteBookmarksAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Bookmarks deleted");
        invalidate();
      } else {
        toast.error(res.error || "Failed to delete bookmarks");
      }
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({
      ids,
      targetWorkspaceId,
    }: {
      ids: string[];
      targetWorkspaceId: string;
    }) => moveBookmarksAction(ids, targetWorkspaceId),
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Bookmarks moved");
        invalidate();
      } else {
        toast.error(res.error || "Failed to move bookmarks");
      }
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      renameBookmarkAction(id, title),
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Bookmark renamed");
        invalidate();
      } else {
        toast.error(res.error || "Failed to rename bookmark");
      }
    },
  });

  const filteredBookmarks = useMemo(() => {
    if (!searchQuery) return bookmarks;
    const query = searchQuery.toLowerCase();
    return bookmarks.filter(
      (b: Bookmark) =>
        b.title?.toLowerCase().includes(query) ||
        b.url.toLowerCase().includes(query) ||
        b.domain?.toLowerCase().includes(query),
    );
  }, [bookmarks, searchQuery]);

  return {
    bookmarks,
    filteredBookmarks,
    isLoading,
    searchQuery,
    setSearchQuery,
    invalidate,
    addBookmark: addBookmarkAction,
    deleteBookmarks: deleteMutation.mutateAsync,
    moveBookmarks: moveMutation.mutateAsync,
    renameBookmark: renameMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    isMoving: moveMutation.isPending,
    isRenaming: renameMutation.isPending,
  };
}
