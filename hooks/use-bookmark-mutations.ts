"use client";

import { useUser } from "~/components/providers/user-context";
import {
  useAddBookmark,
  useDeleteBookmarks,
  useMoveBookmarks,
  useRefetchBookmarkMetadata,
  useUpdateBookmarkFields,
} from "~/lib/mutations/bookmark.mutations";

export function useBookmarkMutations() {
  const userId = useUser().id;

  const add = useAddBookmark(userId);
  const del = useDeleteBookmarks(userId);
  const move = useMoveBookmarks(userId);
  const refetch = useRefetchBookmarkMetadata(userId);
  const fields = useUpdateBookmarkFields(userId);

  return {
    addBookmark: add.mutate,
    isAddingBookmark: add.isPending,
    deleteBookmarks: del.mutate,
    isDeletingBookmarks: del.isPending,
    moveBookmarks: move.mutate,
    isMovingBookmarks: move.isPending,
    refetchBookmarkMetadata: refetch.mutate,
    isRefetchingMetadata: refetch.isPending,
    refetchingId: refetch.isPending ? (refetch.variables?.id ?? null) : null,
    updateBookmarkFields: fields.mutate,
    isUpdatingBookmarkFields: fields.isPending,
  };
}
