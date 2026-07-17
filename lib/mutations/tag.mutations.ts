import { useQueryClient } from "@tanstack/react-query";
import {
  addTagToBookmark,
  deleteTag,
  removeTagFromBookmark,
  renameTag,
  setBookmarkTags,
} from "~/app/action/tag.action";
import { useOptimisticMutation } from "~/lib/mutations/base";
import { bookmarkKeys, tagKeys } from "~/lib/query-keys";
import type {
  AddTagToBookmarkInput,
  DeleteTagInput,
  RemoveTagFromBookmarkInput,
  RenameTagInput,
  SetBookmarkTagsInput,
  Tag,
} from "~/lib/schemas/tag.schema";

export function useAddTagToBookmark(_userId: string | undefined) {
  return useOptimisticMutation<AddTagToBookmarkInput, Tag>({
    mutationFn: addTagToBookmark,
    queryKey: tagKeys.all,
    dependentQueryKeys: [bookmarkKeys.all, tagKeys.links],
    successMessage: null,
    errorMessage: "Failed to add tag. Check the name and try again.",
  });
}

export function useRemoveTagFromBookmark(_userId: string | undefined) {
  return useOptimisticMutation<RemoveTagFromBookmarkInput, null>({
    mutationFn: removeTagFromBookmark,
    queryKey: tagKeys.all,
    dependentQueryKeys: [bookmarkKeys.all, tagKeys.links],
    successMessage: null,
    errorMessage: "Failed to remove tag. Please try again.",
  });
}

export function useSetBookmarkTags(_userId: string | undefined) {
  const queryClient = useQueryClient();

  return useOptimisticMutation<SetBookmarkTagsInput, Tag[]>({
    mutationFn: setBookmarkTags,
    queryKey: tagKeys.all,
    dependentQueryKeys: [bookmarkKeys.all, tagKeys.links],
    successMessage: "Tags updated",
    errorMessage: "Failed to update tags. Please try again.",
    prepareOptimisticData: (_oldData, { bookmarkId, tags }) => {
      queryClient.setQueryData<Tag[]>(tagKeys.byBookmark(bookmarkId), (old) => {
        if (!old) return old;
        const map = new Map(old.map((t) => [t.id, t]));
        return tags
          .map((entry) => (entry.id ? map.get(entry.id) : null))
          .filter((t): t is Tag => t !== undefined && t !== null);
      });
    },
  });
}

export function useRenameTag(_userId: string | undefined) {
  return useOptimisticMutation<RenameTagInput, Tag>({
    mutationFn: renameTag,
    queryKey: tagKeys.all,
    dependentQueryKeys: [bookmarkKeys.all],
    successMessage: "Tag renamed",
    errorMessage: "Failed to rename tag. Please try again.",
  });
}

export function useDeleteTag(_userId: string | undefined) {
  return useOptimisticMutation<DeleteTagInput, null>({
    mutationFn: deleteTag,
    queryKey: tagKeys.all,
    dependentQueryKeys: [bookmarkKeys.all, tagKeys.links],
    successMessage: "Tag deleted",
    errorMessage: "Failed to delete tag. Please try again.",
  });
}
