"use client";

import { useQuery } from "@tanstack/react-query";

import type { TagWithCount } from "~/lib/schemas/tag.schema";

import { useUser } from "~/components/providers/user-context";
import {
  tagsWithCountQueryOptions,
  workspaceTagsWithCountQueryOptions,
} from "~/lib/queries/tag.queries";

export function useUserTagsWithCount() {
  const serverUser = useUser();
  const userId = serverUser.id;

  const { data: tags = [], isLoading } = useQuery<TagWithCount[]>(
    tagsWithCountQueryOptions(userId),
  );

  return { tags, isLoading };
}

export function useWorkspaceTagsWithCount(workspaceId?: string) {
  const userId = useUser().id;

  const { data: tags = [], isLoading } = useQuery<TagWithCount[]>(
    workspaceTagsWithCountQueryOptions(userId, workspaceId),
  );

  return { tags, isLoading };
}
