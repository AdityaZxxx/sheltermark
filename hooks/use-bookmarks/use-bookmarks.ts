"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSupabase } from "~/components/providers/supabase-provider";
import { useUser } from "~/components/providers/user-context";
import { bookmarksQueryOptions } from "~/lib/queries/bookmark.queries";
import { userTagsQueryOptions } from "~/lib/queries/tag.queries";
import { bookmarkKeys, tagKeys, workspaceKeys } from "~/lib/query-keys";
import type { Bookmark, BookmarkSort } from "~/lib/schemas/bookmark.schema";
import type { Tag } from "~/lib/schemas/tag.schema";

const DEFAULT_SORT: BookmarkSort = { sortBy: "created_at", sortOrder: "desc" };

type BookmarkTagLink = { bookmark_id: string; tag_id: string };

async function fetchAllBookmarkTags(
  supabase: ReturnType<typeof useSupabase>["supabase"],
  userId: string,
): Promise<BookmarkTagLink[]> {
  const { data, error } = await supabase
    .from("bookmark_tags")
    .select("bookmark_id, tag_id, bookmarks!inner(user_id)")
    .eq("bookmarks.user_id", userId);

  if (error) throw new Error(error.message);
  return (data ?? []) as BookmarkTagLink[];
}

export function useBookmarks(workspaceId?: string) {
  const queryClient = useQueryClient();
  const { supabase, user: supabaseUser } = useSupabase();
  const serverUser = useUser();
  const userId = serverUser?.id ?? supabaseUser?.id;

  const { data: allBookmarks = [], isLoading } = useQuery<Bookmark[]>(
    bookmarksQueryOptions(userId),
  );

  const { data: allTags = [] } = useQuery<Tag[]>(userTagsQueryOptions);

  const { data: bookmarkTagLinks = [] } = useQuery<BookmarkTagLink[]>({
    queryKey: tagKeys.all,
    queryFn: () => fetchAllBookmarkTags(supabase, userId ?? ""),
    enabled: !!userId,
  });

  const tagsByBookmarkId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const link of bookmarkTagLinks) {
      const existing = map.get(link.bookmark_id);
      if (existing) {
        existing.push(link.tag_id);
      } else {
        map.set(link.bookmark_id, [link.tag_id]);
      }
    }
    return map;
  }, [bookmarkTagLinks]);

  const tagsById = useMemo(() => {
    const map = new Map<string, Tag>();
    for (const tag of allTags) {
      map.set(tag.id, tag);
    }
    return map;
  }, [allTags]);

  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<BookmarkSort>(DEFAULT_SORT);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const filteredBookmarks = useMemo(() => {
    return workspaceId
      ? allBookmarks.filter((b) => b.workspace_id === workspaceId)
      : allBookmarks;
  }, [allBookmarks, workspaceId]);

  const tagFilteredBookmarks = useMemo(() => {
    if (selectedTagIds.length === 0) return filteredBookmarks;
    return filteredBookmarks.filter((b) => {
      const bookmarkTags = tagsByBookmarkId.get(b.id) ?? [];
      return selectedTagIds.every((tagId) => bookmarkTags.includes(tagId));
    });
  }, [filteredBookmarks, selectedTagIds, tagsByBookmarkId]);

  const searchedBookmarks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tagFilteredBookmarks;
    return tagFilteredBookmarks.filter((b) => {
      if (
        (b.title || "").toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q) ||
        (b.note || "").toLowerCase().includes(q)
      ) {
        return true;
      }
      const bookmarkTagIds = tagsByBookmarkId.get(b.id) ?? [];
      for (const tagId of bookmarkTagIds) {
        const tag = tagsById.get(tagId);
        if (tag?.name?.toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [tagFilteredBookmarks, searchQuery, tagsByBookmarkId, tagsById]);

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
    queryClient.invalidateQueries({ queryKey: tagKeys.all });
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
    allTags,
    tagsByBookmarkId,
    selectedTagIds,
    setSelectedTagIds,
    isLoading: isLoading,
    searchQuery,
    setSearchQuery,
    sort,
    setSort,
    invalidate,
  };
}
