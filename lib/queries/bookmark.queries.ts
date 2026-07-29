import type { Bookmark } from "~/lib/schemas/bookmark.schema";

import { getBookmarks } from "~/app/action/bookmark.action";
import { bookmarkKeys } from "~/lib/query-keys";

export const bookmarksQueryOptions = (userId: string | undefined) => ({
  queryKey: bookmarkKeys.all,
  queryFn: async () => {
    const result = await getBookmarks();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  enabled: !!userId,
  refetchOnMount: false,
  placeholderData: (previousData: Bookmark[] | undefined) => previousData,
});
