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

  const { data: allBookmarks = [], isLoading } = useQuery<Bookmark[]>({
    queryKey: ["bookmarks"],
    queryFn: async () => {
      const { data, error } = await getBookmarks();
      if (error) throw new Error(error);
      return data as Bookmark[];
    },
    staleTime: 30000,
  });

  const filteredBookmarks = useMemo(() => {
    let result = allBookmarks;

    // Filter by workspace
    if (!workspaceId) {
      result = result.filter((b) => !b.workspace_id);
    } else {
      result = result.filter((b) => b.workspace_id === workspaceId);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (b: Bookmark) =>
          b.title?.toLowerCase().includes(query) ||
          b.url.toLowerCase().includes(query) ||
          b.domain?.toLowerCase().includes(query),
      );
    }

    return result;
  }, [allBookmarks, workspaceId, searchQuery]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    queryClient.invalidateQueries({ queryKey: ["workspaces"] });
  };

  const deleteMutation = useMutation({
    mutationFn: deleteBookmarksAction,
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks"] });
      const previous = queryClient.getQueryData<Bookmark[]>(["bookmarks"]);
      queryClient.setQueryData<Bookmark[]>(["bookmarks"], (old) =>
        old ? old.filter((b) => !ids.includes(b.id)) : [],
      );
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["bookmarks"], context.previous);
      }
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Bookmarks deleted");
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
    onMutate: async ({ ids, targetWorkspaceId }) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks"] });
      const previous = queryClient.getQueryData<Bookmark[]>(["bookmarks"]);
      queryClient.setQueryData<Bookmark[]>(["bookmarks"], (old) =>
        old
          ? old.map((b) =>
              ids.includes(b.id)
                ? { ...b, workspace_id: targetWorkspaceId }
                : b,
            )
          : [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["bookmarks"], context.previous);
      }
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Bookmarks moved");
      } else {
        toast.error(res.error || "Failed to move bookmarks");
      }
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      renameBookmarkAction(id, title),
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks"] });
      const previous = queryClient.getQueryData<Bookmark[]>(["bookmarks"]);
      queryClient.setQueryData<Bookmark[]>(["bookmarks"], (old) =>
        old ? old.map((b) => (b.id === id ? { ...b, title } : b)) : [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["bookmarks"], context.previous);
      }
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Bookmark renamed");
      } else {
        toast.error(res.error || "Failed to rename bookmark");
      }
    },
  });

  return {
    bookmarks: filteredBookmarks,
    allBookmarks,
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
