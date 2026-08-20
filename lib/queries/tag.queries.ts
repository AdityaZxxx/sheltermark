import type { Tag, TagWithCount } from "~/lib/schemas/tag.schema";

import {
  getTagsWithCount,
  getUserTags,
  getWorkspaceTagsWithCount,
} from "~/app/action/tag.action";
import { tagKeys } from "~/lib/query-keys";

export const userTagsQueryOptions = {
  queryKey: tagKeys.all,
  queryFn: async () => {
    const result = await getUserTags();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  refetchOnMount: false,
  placeholderData: (previousData: Tag[] | undefined) => previousData,
};

export const tagsWithCountQueryOptions = (userId: string | undefined) => ({
  queryKey: tagKeys.withCount,
  queryFn: async () => {
    const result = await getTagsWithCount();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  enabled: !!userId,
  refetchOnMount: false,
  placeholderData: (previousData: TagWithCount[] | undefined) => previousData,
});

export const workspaceTagsWithCountQueryOptions = (
  userId: string | undefined,
  workspaceId: string | undefined,
) => ({
  queryKey: tagKeys.byWorkspace(workspaceId ?? ""),
  queryFn: async () => {
    if (!workspaceId) throw new Error("workspaceId is required");
    const result = await getWorkspaceTagsWithCount(workspaceId);
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  enabled: !!userId && !!workspaceId,
  refetchOnMount: false,
  placeholderData: (previousData: TagWithCount[] | undefined) => previousData,
});
