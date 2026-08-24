import type { Feed } from "~/lib/schemas/feed.schema";

import { getFeeds } from "~/app/action/feed.action";
import { feedKeys } from "~/lib/query-keys";

export const feedsQueryOptions = (userId: string) => ({
  queryKey: feedKeys.all(userId),
  queryFn: async () => {
    const result = await getFeeds();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  refetchOnMount: false,
  placeholderData: (previousData: Feed[] | undefined) => previousData,
});
