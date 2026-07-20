"use client";

import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "~/components/providers/supabase-provider";
import { useUser } from "~/components/providers/user-context";
import {
  tagsWithCountQueryOptions,
  workspaceTagsWithCountQueryOptions,
} from "~/lib/queries/tag.queries";
import type { TagWithCount } from "~/lib/schemas/tag.schema";

export function useUserTagsWithCount() {
  const { user: supabaseUser } = useSupabase();
  const serverUser = useUser();
  const userId = serverUser?.id ?? supabaseUser?.id;

  const { data: tags = [], isLoading } = useQuery<TagWithCount[]>(
    tagsWithCountQueryOptions(userId),
  );

  return { tags, isLoading };
}

export function useWorkspaceTagsWithCount(workspaceId: string | undefined) {
  const { user: supabaseUser } = useSupabase();
  const serverUser = useUser();
  const userId = serverUser?.id ?? supabaseUser?.id;

  const { data: tags = [], isLoading } = useQuery<TagWithCount[]>(
    workspaceTagsWithCountQueryOptions(userId, workspaceId),
  );

  return { tags, isLoading };
}
