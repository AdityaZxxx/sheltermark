"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";

import type { Bookmark, BookmarkSort } from "~/lib/schemas/bookmark.schema";
import type { Tag } from "~/lib/schemas/tag.schema";

import { useSupabase } from "~/components/providers/supabase-provider";
import { useUser } from "~/components/providers/user-context";
import {
  buildBookmarkSearchIndex,
  filterBookmarksBySearch,
  filterBookmarksByTags,
  filterBookmarksByWorkspace,
  sortBookmarks as sortBookmarksFn,
} from "~/lib/queries/bookmark-filters";
import { bookmarksQueryOptions } from "~/lib/queries/bookmark.queries";
import { userTagsQueryOptions } from "~/lib/queries/tag.queries";
import { workspacesQueryOptions } from "~/lib/queries/workspace.queries";
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
  const { supabase } = useSupabase();
  const userId = useUser().id;

  const { data: allBookmarks = [], isLoading } = useQuery<Bookmark[]>(
    bookmarksQueryOptions(userId),
  );

  const { data: allTags = [] } = useQuery<Tag[]>(userTagsQueryOptions(userId));

  const { data: bookmarkTagLinks = [] } = useQuery<BookmarkTagLink[]>({
    queryKey: tagKeys.links(userId),
    queryFn: () => fetchAllBookmarkTags(supabase, userId),
  });

  // Workspace names only feed the dashboard-scope search index.
  const { data: allWorkspaces = [] } = useQuery({
    ...workspacesQueryOptions(userId),
    enabled: !workspaceId,
  });

  const tagsByBookmarkId = new Map<string, string[]>();
  for (const link of bookmarkTagLinks) {
    const existing = tagsByBookmarkId.get(link.bookmark_id);
    if (existing) {
      existing.push(link.tag_id);
    } else {
      tagsByBookmarkId.set(link.bookmark_id, [link.tag_id]);
    }
  }

  // On the dashboard (no workspace scope), the workspace name becomes a
  // searchable field so users can find bookmarks via where they filed them.
  let wsNameById: Map<string, string> | undefined;
  if (!workspaceId) {
    wsNameById = new Map(allWorkspaces.map((ws) => [ws.id, ws.name] as const));
  }

  const searchIndex = buildBookmarkSearchIndex(
    allBookmarks,
    tagsByBookmarkId,
    new Map(allTags.map((t) => [t.id, t] as const)),
    wsNameById,
  );

  const [searchQuery, setSearchQueryRaw] = useState("");
  const [sort, setSort] = useState<BookmarkSort>(DEFAULT_SORT);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // AI-assisted search is a thin layer over FTS: aiTerms holds the
  // interpreted terms for the current query; any edit to the raw input
  // discards them so stale AI terms never apply to a new query.
  const [aiTerms, setAiTerms] = useState<string[] | null>(null);

  const setSearchQuery = (q: string) => {
    setAiTerms(null);
    setSearchQueryRaw(q);
  };

  const effectiveQuery = aiTerms ? aiTerms.join(" ") : searchQuery;

  const bookmarks = sortBookmarksFn(
    filterBookmarksBySearch(
      filterBookmarksByTags(
        filterBookmarksByWorkspace(allBookmarks, workspaceId),
        selectedTagIds,
        tagsByBookmarkId,
      ),
      effectiveQuery,
      searchIndex,
      // AI terms OR-match: a bookmark about "react" alone is still
      // relevant to "react performance".
      { matchAll: !aiTerms },
    ),
    sort,
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: bookmarkKeys.all(userId) });
    queryClient.invalidateQueries({ queryKey: tagKeys.all(userId) });
    queryClient.invalidateQueries({ queryKey: tagKeys.links(userId) });
    queryClient.invalidateQueries({
      queryKey: workspaceKeys.all(userId),
    });
  };

  return {
    userId,
    bookmarks,
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
    // Identity of the current filter context; used to suppress exit
    // animations when items vanish from filtering rather than deletion.
    filterKey: `${workspaceId ?? "all"}|${selectedTagIds.join(",")}|${effectiveQuery}|${aiTerms ? "ai" : ""}`,
    aiSearchTerms: aiTerms,
    setAiSearchTerms: setAiTerms,
  };
}
