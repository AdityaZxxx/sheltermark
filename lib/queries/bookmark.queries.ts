import { getBookmarks } from "~/app/action/bookmark.action";
import { bookmarkKeys } from "~/lib/query-keys";
import type { Bookmark } from "~/lib/schemas/bookmark.schema";

export const bookmarksQueryOptions = (userId: string | undefined) => ({
  queryKey: bookmarkKeys.all,
  queryFn: async () => {
    const result = await getBookmarks();
    if (!result?.success) throw new Error(result?.error);
    return result.data as Bookmark[];
  },
  enabled: !!userId,
  refetchOnMount: false,
  placeholderData: (previousData: Bookmark[] | undefined) => previousData,
});
