import type { Tag, TagWithCount } from "~/lib/schemas/tag.schema";

import {
  getTagsWithCount,
  getUserTags,
  getWorkspaceTagsWithCount,
} from "~/app/action/tag.action";
import { tagKeys } from "~/lib/query-keys";

export const userTagsQueryOptions = (userId: string) => ({
  queryKey: tagKeys.all(userId),
  queryFn: async () => {
    const result = await getUserTags();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  refetchOnMount: false,
  placeholderData: (previousData: Tag[] | undefined) => previousData,
});

export const tagsWithCountQueryOptions = (userId: string) => ({
  queryKey: tagKeys.withCount(userId),
  queryFn: async () => {
    const result = await getTagsWithCount();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  refetchOnMount: false,
  placeholderData: (previousData: TagWithCount[] | undefined) => previousData,
});

export const workspaceTagsWithCountQueryOptions = (
  userId: string,
  workspaceId?: string,
) => ({
  queryKey: tagKeys.byWorkspace(userId, workspaceId ?? ""),
  queryFn: async () => {
    if (!workspaceId) throw new Error("workspaceId is required");
    const result = await getWorkspaceTagsWithCount(workspaceId);
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  enabled: !!workspaceId,
  refetchOnMount: false,
  placeholderData: (previousData: TagWithCount[] | undefined) => previousData,
});
