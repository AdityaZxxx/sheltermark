import type {
  Bookmark,
  BookmarkDeleteInput,
  BookmarkEditInput,
  BookmarkMoveInput,
} from "~/lib/schemas/bookmark.schema";
import type { Tag } from "~/lib/schemas/tag.schema";

import {
  addBookmark,
  deleteBookmarks,
  moveBookmarks,
  refetchBookmarkMetadata,
  updateBookmarkFields,
} from "~/app/action/bookmark.action";
import {
  optimisticPrepend,
  optimisticRemove,
  optimisticUpdate,
  useOptimisticMutation,
} from "~/lib/mutations/base";
import {
  updateBookmarkFieldsDependentKeys,
  updateBookmarkFieldsUpdates,
} from "~/lib/mutations/tag.invalidation";
import { bookmarkKeys, trashKeys, workspaceKeys } from "~/lib/query-keys";

export function useAddBookmark(userId: string) {
  return useOptimisticMutation<
    { url: string; workspaceId: string; clientId?: string },
    Bookmark,
    Bookmark[]
  >({
    mutationFn: ({ url, workspaceId, clientId }) =>
      addBookmark({
        url,
        workspaceId,
        clientId: clientId ?? crypto.randomUUID(),
      }),
    mutationKey: ["addBookmark"],
    queryKey: bookmarkKeys.all(userId),
    dependentQueryKeys: userId ? [workspaceKeys.all(userId)] : [],
    successMessage: "Bookmark added",
    successMessageOnMutate: true,
    errorMessage: "Failed to add bookmark",
    invalidateOnSettled: false,
    prepareOptimisticData: (oldData, { url, workspaceId, clientId }) => {
      const id = clientId ?? crypto.randomUUID();
      const title = (() => {
        try {
          return new URL(url).hostname;
        } catch {
          return url;
        }
      })();
      const optimistic: Bookmark = {
        id,
        url,
        title,
        http_status: null,
        last_checked_at: null,
        is_broken: false,
        broken_status: "alive",
        is_public: false,
        favicon_url: null,
        og_image_url: null,
        workspace_id: workspaceId,
        user_id: userId || "",
        updated_at: null,
        created_at: new Date().toISOString(),
        note: null,
        deleted_at: null,
      };
      return optimisticPrepend(oldData, optimistic);
    },
    onSuccessData: (data, client) => {
      const key = bookmarkKeys.all(userId);
      client.setQueryData<Bookmark[]>(key, (old) => {
        if (!old) return [data];
        return old.map((b) => (b.id === data.id ? { ...b, ...data } : b));
      });
    },
  });
}

export function useDeleteBookmarks(userId: string) {
  return useOptimisticMutation<BookmarkDeleteInput, null, Bookmark[]>({
    mutationFn: deleteBookmarks,
    mutationKey: ["deleteBookmarks"],
    queryKey: bookmarkKeys.all(userId),
    dependentQueryKeys: userId
      ? [trashKeys.all(userId), workspaceKeys.all(userId)]
      : [trashKeys.all(userId)],
    successMessage: null,
    errorMessage: "Failed to delete bookmarks",
    prepareOptimisticData: (oldData, { ids }) => {
      return optimisticRemove(oldData, ids);
    },
  });
}

export function useMoveBookmarks(userId: string) {
  return useOptimisticMutation<
    BookmarkMoveInput,
    { movedCount: number; skippedCount: number },
    Bookmark[]
  >({
    mutationFn: moveBookmarks,
    mutationKey: ["moveBookmarks"],
    queryKey: bookmarkKeys.all(userId),
    dependentQueryKeys: userId ? [workspaceKeys.all(userId)] : [],
    successMessage: null,
    errorMessage: "Failed to move bookmarks",
    prepareOptimisticData: (oldData, { ids, targetWorkspaceId }) => {
      const prev = oldData ?? [];
      const idSet = new Set(ids);
      return prev.map((b) =>
        idSet.has(b.id) ? { ...b, workspace_id: targetWorkspaceId } : b,
      );
    },
  });
}

export function useRefetchBookmarkMetadata(userId: string) {
  return useOptimisticMutation<{ id: string }, null, Bookmark[]>({
    mutationFn: refetchBookmarkMetadata,
    mutationKey: ["refetchBookmarkMetadata"],
    queryKey: bookmarkKeys.all(userId),
    successMessage: "Metadata refreshed",
    errorMessage: "Failed to refresh metadata",
    prepareOptimisticData: (oldData, { id }) => {
      return optimisticUpdate(oldData, id, (b) => ({
        ...b,
        last_checked_at: new Date().toISOString(),
      }));
    },
  });
}

export function useUpdateBookmarkFields(userId: string) {
  return useOptimisticMutation<BookmarkEditInput, Tag[], Bookmark[]>({
    mutationFn: updateBookmarkFields,
    mutationKey: ["updateBookmarkFields"],
    queryKey: bookmarkKeys.all(userId),
    dependentQueryKeys: updateBookmarkFieldsDependentKeys(userId),
    successMessage: "Bookmark updated",
    successMessageOnMutate: true,
    errorMessage: "Failed to save changes",
    prepareOptimisticData: (oldData, { id, title, note }) => {
      return optimisticUpdate(oldData, id, (b) => ({
        ...b,
        title,
        note,
        updated_at: new Date().toISOString(),
      }));
    },
    additionalOptimisticUpdates: ({ id, tags }) => {
      const links: Array<{ bookmark_id: string; tag_id: string }> = [];
      for (const tag of tags) {
        if (tag.id) links.push({ bookmark_id: id, tag_id: tag.id });
      }
      return updateBookmarkFieldsUpdates(userId, id, links);
    },
  });
}
