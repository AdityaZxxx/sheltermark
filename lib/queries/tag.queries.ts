import {
  getBookmarkTags,
  getTagsWithCount,
  getUserTags,
  getWorkspaceTagsWithCount,
} from "~/app/action/tag.action";
import { tagKeys } from "~/lib/query-keys";
import type { Tag, TagWithCount } from "~/lib/schemas/tag.schema";

export const userTagsQueryOptions = {
  queryKey: tagKeys.all,
  queryFn: async () => {
    const result = await getUserTags();
    if (!result?.success) throw new Error(result?.error);
    return result.data as Tag[];
  },
};

export const tagsWithCountQueryOptions = (userId: string | undefined) => ({
  queryKey: tagKeys.withCount,
  queryFn: async () => {
    const result = await getTagsWithCount();
    if (!result?.success) throw new Error(result?.error);
    return result.data as TagWithCount[];
  },
  enabled: !!userId,
});

export const workspaceTagsWithCountQueryOptions = (
  userId: string | undefined,
  workspaceId: string | undefined,
) => ({
  queryKey: tagKeys.byWorkspace(workspaceId ?? ""),
  queryFn: async () => {
    if (!workspaceId) throw new Error("workspaceId is required");
    const result = await getWorkspaceTagsWithCount(workspaceId);
    if (!result?.success) throw new Error(result?.error);
    return result.data as TagWithCount[];
  },
  enabled: !!userId && !!workspaceId,
});

export const bookmarkTagsQueryOptions = (
  bookmarkId: string,
  userId: string | undefined,
) => ({
  queryKey: tagKeys.byBookmark(bookmarkId),
  queryFn: async () => {
    const result = await getBookmarkTags({ bookmarkId });
    if (!result?.success) throw new Error(result?.error);
    return result.data as Tag[];
  },
  enabled: !!userId && !!bookmarkId,
});
