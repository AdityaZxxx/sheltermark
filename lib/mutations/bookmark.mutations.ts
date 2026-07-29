import type {
  Bookmark,
  BookmarkDeleteInput,
  BookmarkEditInput,
  BookmarkMoveInput,
  BookmarkRenameInput,
  BookmarkUpdateNoteInput,
} from "~/lib/schemas/bookmark.schema";
import type { Tag } from "~/lib/schemas/tag.schema";

import {
  addBookmark,
  deleteBookmarks,
  moveBookmarks,
  refetchBookmarkMetadata,
  renameBookmark,
  updateBookmarkFields,
  updateBookmarkNote,
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

const generateTempId = () =>
  `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function useAddBookmark(userId: string | undefined) {
  return useOptimisticMutation<
    { url: string; workspaceId: string },
    Bookmark,
    Bookmark[]
  >({
    mutationFn: ({ url, workspaceId }) => addBookmark({ url, workspaceId }),
    mutationKey: ["addBookmark"],
    queryKey: bookmarkKeys.all,
    dependentQueryKeys: userId ? [workspaceKeys.byUser(userId)] : [],
    successMessage: "Bookmark added",
    errorMessage: "Failed to add bookmark",
    prepareOptimisticData: (oldData, { url, workspaceId }) => {
      const optimistic: Bookmark = {
        id: generateTempId(),
        url,
        title: url,
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
  });
}

export function useDeleteBookmarks(userId: string | undefined) {
  return useOptimisticMutation<BookmarkDeleteInput, null, Bookmark[]>({
    mutationFn: deleteBookmarks,
    mutationKey: ["deleteBookmarks"],
    queryKey: bookmarkKeys.all,
    dependentQueryKeys: userId
      ? [trashKeys.all, workspaceKeys.byUser(userId)]
      : [trashKeys.all],
    successMessage: null,
    errorMessage: "Failed to delete bookmarks",
    prepareOptimisticData: (oldData, { ids }) => {
      return optimisticRemove(oldData, ids);
    },
  });
}

export function useRenameBookmark(_userId: string | undefined) {
  return useOptimisticMutation<BookmarkRenameInput, null, Bookmark[]>({
    mutationFn: renameBookmark,
    mutationKey: ["renameBookmark"],
    queryKey: bookmarkKeys.all,
    successMessage: "Bookmark renamed",
    errorMessage: "Failed to rename bookmark",
    prepareOptimisticData: (oldData, { id, title }) => {
      return optimisticUpdate(oldData, id, (b) => ({ ...b, title }));
    },
  });
}

export function useMoveBookmarks(userId: string | undefined) {
  return useOptimisticMutation<
    BookmarkMoveInput,
    { movedCount: number; skippedCount: number },
    Bookmark[]
  >({
    mutationFn: moveBookmarks,
    mutationKey: ["moveBookmarks"],
    queryKey: bookmarkKeys.all,
    dependentQueryKeys: userId ? [workspaceKeys.byUser(userId)] : [],
    successMessage: null,
    errorMessage: "Failed to move bookmarks",
    prepareOptimisticData: (oldData, { ids }) => {
      return optimisticRemove(oldData, ids);
    },
  });
}

export function useRefetchBookmarkMetadata(_userId: string | undefined) {
  return useOptimisticMutation<{ id: string }, null, Bookmark[]>({
    mutationFn: refetchBookmarkMetadata,
    mutationKey: ["refetchBookmarkMetadata"],
    queryKey: bookmarkKeys.all,
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

export function useUpdateBookmarkNote(_userId: string | undefined) {
  return useOptimisticMutation<BookmarkUpdateNoteInput, null, Bookmark[]>({
    mutationFn: updateBookmarkNote,
    queryKey: bookmarkKeys.all,
    successMessage: "Note saved",
    errorMessage: "Failed to save note",
    prepareOptimisticData: (oldData, { id, note }) => {
      return optimisticUpdate(oldData, id, (b) => ({ ...b, note }));
    },
  });
}

export function useUpdateBookmarkFields(_userId: string | undefined) {
  return useOptimisticMutation<BookmarkEditInput, Tag[], Bookmark[]>({
    mutationFn: updateBookmarkFields,
    mutationKey: ["updateBookmarkFields"],
    queryKey: bookmarkKeys.all,
    dependentQueryKeys: updateBookmarkFieldsDependentKeys(),
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
      return updateBookmarkFieldsUpdates(id, links);
    },
  });
}
