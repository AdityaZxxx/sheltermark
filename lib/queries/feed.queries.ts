import { getFeeds } from "~/app/action/feed.action";
import { feedKeys } from "~/lib/query-keys";
import type { Feed } from "~/lib/schemas/feed.schema";

export const feedsQueryOptions = (userId: string | undefined) => ({
  queryKey: feedKeys.byUser(userId),
  queryFn: async () => {
    const result = await getFeeds();
    if (!result.success) throw new Error(result.error);
    return result.data as Feed[];
  },
  enabled: !!userId,
});
