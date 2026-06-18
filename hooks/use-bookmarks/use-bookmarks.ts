"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSupabase } from "~/components/providers/supabase-provider";
import { useUser } from "~/components/providers/user-context";
import { bookmarksQueryOptions } from "~/lib/queries/bookmark.queries";
import { bookmarkKeys, workspaceKeys } from "~/lib/query-keys";
import type { Bookmark, BookmarkSort } from "~/lib/schemas/bookmark.schema";

const DEFAULT_SORT: BookmarkSort = { sortBy: "created_at", sortOrder: "desc" };

export function useBookmarks(workspaceId?: string) {
  const queryClient = useQueryClient();
  const { user: supabaseUser } = useSupabase();
  const serverUser = useUser();
  const userId = serverUser?.id ?? supabaseUser?.id;

  const { data: allBookmarks = [], isLoading } = useQuery<Bookmark[]>(
    bookmarksQueryOptions(userId),
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<BookmarkSort>(DEFAULT_SORT);

  const filteredBookmarks = useMemo(() => {
    return workspaceId
      ? allBookmarks.filter((b) => b.workspace_id === workspaceId)
      : allBookmarks;
  }, [allBookmarks, workspaceId]);

  const searchedBookmarks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return q
      ? filteredBookmarks.filter(
          (b) =>
            (b.title || "").toLowerCase().includes(q) ||
            b.url.toLowerCase().includes(q) ||
            (b.note || "").toLowerCase().includes(q),
        )
      : filteredBookmarks;
  }, [filteredBookmarks, searchQuery]);

  const bookmarks = useMemo(() => {
    return searchedBookmarks.toSorted((a, b) => {
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
  }, [searchedBookmarks, sort]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
    if (userId) {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.byUser(userId),
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
