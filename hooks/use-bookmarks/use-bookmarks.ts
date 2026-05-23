"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";

import type { Bookmark, BookmarkSort } from "~/lib/schemas/bookmark.schema";
import type { Tag } from "~/lib/schemas/tag.schema";

import { useSupabase } from "~/components/providers/supabase-provider";
import { useUser } from "~/components/providers/user-context";
import {
  filterBookmarksBySearch,
  filterBookmarksByTags,
  filterBookmarksByWorkspace,
  sortBookmarks as sortBookmarksFn,
} from "~/lib/queries/bookmark-filters";
import { bookmarksQueryOptions } from "~/lib/queries/bookmark.queries";
import { userTagsQueryOptions } from "~/lib/queries/tag.queries";
import { bookmarkKeys, tagKeys, workspaceKeys } from "~/lib/query-keys";
import { uuidSchema } from "~/lib/schemas/common";

const DEFAULT_SORT: BookmarkSort = { sortBy: "created_at", sortOrder: "desc" };

const bookmarkTagLinkSchema = z.object({
  bookmark_id: uuidSchema,
  tag_id: uuidSchema,
});

type BookmarkTagLink = z.infer<typeof bookmarkTagLinkSchema>;

async function fetchAllBookmarkTags(
  supabase: ReturnType<typeof useSupabase>["supabase"],
  userId: string,
): Promise<BookmarkTagLink[]> {
  const { data, error } = await supabase
    .from("bookmark_tags")
    .select("bookmark_id, tag_id, bookmarks!inner(user_id)")
    .eq("bookmarks.user_id", userId);

  if (error) throw new Error(error.message);
  const parsed = z.array(bookmarkTagLinkSchema).safeParse(data ?? []);
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data;
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
    queryKey: tagKeys.links,
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

  const bookmarks = useMemo(() => {
    const filtered = filterBookmarksByWorkspace(allBookmarks, workspaceId);
    const tagged = filterBookmarksByTags(
      filtered,
      selectedTagIds,
      tagsByBookmarkId,
    );
    const searched = filterBookmarksBySearch(
      tagged,
      searchQuery,
      tagsByBookmarkId,
      tagsById,
    );
    return sortBookmarksFn(searched, sort);
  }, [
    allBookmarks,
    workspaceId,
    selectedTagIds,
    tagsByBookmarkId,
    searchQuery,
    tagsById,
    sort,
  ]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
    queryClient.invalidateQueries({ queryKey: tagKeys.all });
    queryClient.invalidateQueries({ queryKey: tagKeys.links });
    if (userId) {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.byUser(userId),
      });
    }
  };

  return {
    bookmarks,
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
