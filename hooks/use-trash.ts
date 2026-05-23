"use client";

import { useQuery } from "@tanstack/react-query";

import type { Bookmark } from "~/lib/schemas/bookmark.schema";
import type { TrashedWorkspace } from "~/lib/schemas/workspace.schema";

import { useSupabase } from "~/components/providers/supabase-provider";
import { useUser } from "~/components/providers/user-context";
import {
  trashedBookmarksQueryOptions,
  trashedWorkspacesQueryOptions,
} from "~/lib/queries/trash.queries";

export function useTrash() {
  const { user: supabaseUser } = useSupabase();
  const serverUser = useUser();
  const userId = serverUser?.id ?? supabaseUser?.id;

  const bookmarksQuery = useQuery(trashedBookmarksQueryOptions(userId));
  const workspacesQuery = useQuery(trashedWorkspacesQueryOptions(userId));

  const trashedBookmarks: Bookmark[] = bookmarksQuery.data ?? [];
  const trashedWorkspaces: TrashedWorkspace[] = workspacesQuery.data ?? [];

  const totalCount = trashedBookmarks.length + trashedWorkspaces.length;

  return {
    trashedBookmarks,
    trashedWorkspaces,
    isLoading: bookmarksQuery.isLoading || workspacesQuery.isLoading,
    totalCount,
  };
}
