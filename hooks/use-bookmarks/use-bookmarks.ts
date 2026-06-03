"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSupabase } from "~/components/providers/supabase-provider";
import { bookmarkKeys, workspaceKeys } from "~/lib/query-keys";
import type { Bookmark, BookmarkSort } from "~/lib/schemas/bookmark";

const DEFAULT_SORT: BookmarkSort = { sortBy: "created_at", sortOrder: "desc" };

const bookmarksQueryOptions = (userId: string | undefined) => ({
  queryKey: bookmarkKeys.all,
  queryFn: async () => {
    const { getBookmarks } = await import("~/app/action/bookmark");
    const result = await getBookmarks();
    if (!result?.success) throw new Error(result?.error);
    return result.data as Bookmark[];
  },
  enabled: !!userId,
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 30,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
});

export function useBookmarks(workspaceId?: string) {
  const queryClient = useQueryClient();
  const { user } = useSupabase();
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<BookmarkSort>(DEFAULT_SORT);

  const { data: allBookmarks = [], isLoading } = useQuery<Bookmark[]>(
    bookmarksQueryOptions(user?.id),
  );

  const filteredBookmarks = workspaceId
    ? allBookmarks.filter((b) => b.workspace_id === workspaceId)
    : allBookmarks;

  const searchedBookmarks = searchQuery.trim()
    ? filteredBookmarks.filter(
        (b) =>
          (b.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.url.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : filteredBookmarks;

  const bookmarks = [...searchedBookmarks].sort((a, b) => {
    const asc = sort.sortOrder === "asc";
    const cmp = (x: string, y: string) =>
      asc ? x.localeCompare(y) : y.localeCompare(x);
    switch (sort.sortBy) {
      case "title":
        return cmp(a.title ?? "", b.title ?? "");
      case "domain":
        return cmp(a.url, b.url);
      case "updated_at":
        return cmp(a.updated_at ?? "", b.updated_at ?? "");
      default:
        return cmp(a.created_at ?? "", b.created_at ?? "");
    }
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
    if (user?.id) {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.byUser(user.id),
      });
    }
  };

  return {
    bookmarks,
    filteredBookmarks,
    allBookmarks,
    isLoading: isLoading,
    searchQuery,
    setSearchQuery,
    sort,
    setSort,
    invalidate,
  };
}
