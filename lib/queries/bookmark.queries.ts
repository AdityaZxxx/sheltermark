import type { Bookmark } from "~/lib/schemas/bookmark.schema";

import { getBookmarks } from "~/app/action/bookmark.action";
import { bookmarkKeys } from "~/lib/query-keys";

export const bookmarksQueryOptions = (userId: string) => ({
  queryKey: bookmarkKeys.all(userId),
  queryFn: async () => {
    const result = await getBookmarks();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  refetchOnMount: false,
  placeholderData: (previousData: Bookmark[] | undefined) => previousData,
});
