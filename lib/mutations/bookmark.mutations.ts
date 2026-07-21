import {
  addBookmark,
  deleteBookmarks,
  moveBookmarks,
  refetchBookmarkMetadata,
  renameBookmark,
  updateBookmarkFields,
  updateBookmarkNote,
} from "~/app/action/bookmark.action";
import { useOptimisticMutation } from "~/lib/mutations/base";
import {
  bookmarkKeys,
  tagKeys,
  trashKeys,
  workspaceKeys,
} from "~/lib/query-keys";
import type {
  Bookmark,
  BookmarkDeleteInput,
  BookmarkEditInput,
  BookmarkMoveInput,
  BookmarkRenameInput,
  BookmarkUpdateNoteInput,
} from "~/lib/schemas/bookmark.schema";
import type { Tag } from "~/lib/schemas/tag.schema";

const generateTempId = () =>
  `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function useAddBookmark(userId: string | undefined) {
  return useOptimisticMutation<{ url: string; workspaceId: string }, unknown>({
    mutationFn: ({ url, workspaceId }) => addBookmark({ url, workspaceId }),
    mutationKey: ["addBookmark"],
    queryKey: bookmarkKeys.all,
    dependentQueryKeys: userId ? [workspaceKeys.byUser(userId)] : [],
    successMessage: "Bookmark added",
    errorMessage: "Failed to add bookmark",
    prepareOptimisticData: (oldData, { url, workspaceId }) => {
      const prev = (oldData as Bookmark[]) ?? [];
      const tempId = generateTempId();
      const optimistic: Bookmark = {
        id: tempId,
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
      } as Bookmark;
      return [optimistic, ...prev];
    },
  });
}

export function useDeleteBookmarks(userId: string | undefined) {
  return useOptimisticMutation<BookmarkDeleteInput, null>({
    mutationFn: deleteBookmarks,
    mutationKey: ["deleteBookmarks"],
    queryKey: bookmarkKeys.all,
    dependentQueryKeys: userId
      ? [trashKeys.all, workspaceKeys.byUser(userId)]
      : [trashKeys.all],
    successMessage: null,
    errorMessage: "Failed to delete bookmarks",
    prepareOptimisticData: (oldData, { ids }) => {
      const prev = (oldData as Bookmark[]) ?? [];
      const idsToDelete = new Set(ids);
      return prev.filter((b) => !idsToDelete.has(b.id));
    },
  });
}

export function useRenameBookmark(_userId: string | undefined) {
  return useOptimisticMutation<BookmarkRenameInput, null>({
    mutationFn: renameBookmark,
    mutationKey: ["renameBookmark"],
    queryKey: bookmarkKeys.all,
    successMessage: "Bookmark renamed",
    errorMessage: "Failed to rename bookmark",
    prepareOptimisticData: (oldData, { id, title }) => {
      const prev = (oldData as Bookmark[]) ?? [];
      return prev.map((b) => (b.id === id ? { ...b, title } : b));
    },
  });
}

export function useMoveBookmarks(userId: string | undefined) {
  return useOptimisticMutation<
    BookmarkMoveInput,
    { movedCount: number; skippedCount: number }
  >({
    mutationFn: moveBookmarks,
    mutationKey: ["moveBookmarks"],
    queryKey: bookmarkKeys.all,
    dependentQueryKeys: userId ? [workspaceKeys.byUser(userId)] : [],
    successMessage: null,
    errorMessage: "Failed to move bookmarks",
    prepareOptimisticData: (oldData, { ids }) => {
      const prev = (oldData as Bookmark[]) ?? [];
      const idsToMove = new Set(ids);
      return prev.filter((b) => !idsToMove.has(b.id));
    },
  });
}

export function useRefetchBookmarkMetadata(_userId: string | undefined) {
  return useOptimisticMutation<{ id: string }, null>({
    mutationFn: refetchBookmarkMetadata,
    mutationKey: ["refetchBookmarkMetadata"],
    queryKey: bookmarkKeys.all,
    successMessage: "Metadata refreshed",
    errorMessage: "Failed to refresh metadata",
    prepareOptimisticData: (oldData, { id }) => {
      const prev = (oldData as Bookmark[]) ?? [];
      return prev.map((b) =>
        b.id === id ? { ...b, last_checked_at: new Date().toISOString() } : b,
      );
    },
  });
}

export function useUpdateBookmarkNote(_userId: string | undefined) {
  return useOptimisticMutation<BookmarkUpdateNoteInput, null>({
    mutationFn: updateBookmarkNote,
    queryKey: bookmarkKeys.all,
    successMessage: "Note saved",
    errorMessage: "Failed to save note",
    prepareOptimisticData: (oldData, { id, note }) => {
      const prev = (oldData as Bookmark[]) ?? [];
      return prev.map((b) => (b.id === id ? { ...b, note } : b));
    },
  });
}

export function useUpdateBookmarkFields(_userId: string | undefined) {
  return useOptimisticMutation<BookmarkEditInput, Tag[]>({
    mutationFn: updateBookmarkFields,
    mutationKey: ["updateBookmarkFields"],
    queryKey: bookmarkKeys.all,
    dependentQueryKeys: [tagKeys.all, tagKeys.links, tagKeys.withCount],
    successMessage: "Bookmark updated",
    successMessageOnMutate: true,
    errorMessage: "Failed to save changes",
    prepareOptimisticData: (oldData, { id, title, note }) => {
      const prev = (oldData as Bookmark[]) ?? [];
      return prev.map((b) =>
        b.id === id
          ? {
              ...b,
              title,
              note,
              updated_at: new Date().toISOString(),
            }
          : b,
      );
    },
    additionalOptimisticUpdates: ({ id, tags }) => {
      const bookmarkTags: BookmarkTagLink[] = tags
        .filter((t) => t.id)
        .map((t) => ({ bookmark_id: id, tag_id: t.id as string }));

      return [
        {
          key: tagKeys.links,
          updater: (oldData) => {
            const prev = (oldData as BookmarkTagLink[]) ?? [];
            const filtered = prev.filter((l) => l.bookmark_id !== id);
            return [...filtered, ...bookmarkTags];
          },
        },
      ];
    },
  });
}

type BookmarkTagLink = { bookmark_id: string; tag_id: string };
