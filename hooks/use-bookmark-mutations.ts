"use client";

import { useSupabase } from "~/components/providers/supabase-provider";
import {
  useAddBookmark,
  useDeleteBookmarks,
  useMoveBookmarks,
  useRefetchBookmarkMetadata,
  useUpdateBookmarkFields,
} from "~/lib/mutations/bookmark.mutations";

export function useBookmarkMutations() {
  const { user } = useSupabase();

  const add = useAddBookmark(user?.id);
  const del = useDeleteBookmarks(user?.id);
  const move = useMoveBookmarks(user?.id);
  const refetch = useRefetchBookmarkMetadata(user?.id);
  const fields = useUpdateBookmarkFields(user?.id);

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
