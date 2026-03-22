"use client";

import { useSupabase } from "~/components/providers/supabase-provider";
import {
  useAddTagToBookmark,
  useDeleteTag,
  useRemoveTagFromBookmark,
  useRenameTag,
  useSetBookmarkTags,
} from "~/lib/mutations/tag.mutations";

export function useTagMutations() {
  const { user } = useSupabase();

  const add = useAddTagToBookmark(user?.id);
  const remove = useRemoveTagFromBookmark(user?.id);
  const setTags = useSetBookmarkTags(user?.id);
  const rename = useRenameTag(user?.id);
  const del = useDeleteTag(user?.id);

  return {
    addTagToBookmark: add.mutate,
    isAddingTag: add.isPending,
    removeTagFromBookmark: remove.mutate,
    isRemovingTag: remove.isPending,
    setBookmarkTags: setTags.mutate,
    isSettingBookmarkTags: setTags.isPending,
    renameTag: rename.mutate,
    isRenamingTag: rename.isPending,
    deleteTag: del.mutate,
    isDeletingTag: del.isPending,
  };
}
