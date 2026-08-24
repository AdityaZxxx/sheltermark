import type {
  DeleteTagInput,
  RenameTagInput,
  Tag,
} from "~/lib/schemas/tag.schema";

import { deleteTag, renameTag } from "~/app/action/tag.action";
import {
  optimisticRemove,
  optimisticUpdate,
  useOptimisticMutation,
} from "~/lib/mutations/base";
import {
  deleteTagDependentKeys,
  deleteTagUpdates,
  renameTagDependentKeys,
  renameTagUpdates,
} from "~/lib/mutations/tag.invalidation";
import { tagKeys } from "~/lib/query-keys";

export function useRenameTag(userId: string) {
  return useOptimisticMutation<RenameTagInput, Tag, Tag[]>({
    mutationFn: renameTag,
    mutationKey: ["renameTag"],
    queryKey: tagKeys.all(userId),
    dependentQueryKeys: renameTagDependentKeys(userId),
    successMessage: "Tag renamed",
    errorMessage: "Unable to rename tag.",
    prepareOptimisticData: (oldData, { tagId, name }) => {
      return optimisticUpdate(oldData, tagId, (t) => ({ ...t, name }));
    },
    additionalOptimisticUpdates: ({ tagId, name }) =>
      renameTagUpdates(userId, tagId, name),
  });
}

export function useDeleteTag(userId: string) {
  return useOptimisticMutation<DeleteTagInput, null, Tag[]>({
    mutationFn: deleteTag,
    mutationKey: ["deleteTag"],
    queryKey: tagKeys.all(userId),
    dependentQueryKeys: deleteTagDependentKeys(userId),
    successMessage: "Tag deleted",
    errorMessage: "Unable to delete tag.",
    prepareOptimisticData: (oldData, { tagId }) => {
      return optimisticRemove(oldData, tagId);
    },
    additionalOptimisticUpdates: ({ tagId }) => deleteTagUpdates(userId, tagId),
  });
}
