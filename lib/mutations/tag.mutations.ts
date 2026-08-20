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

export function useRenameTag(_userId: string | undefined) {
  return useOptimisticMutation<RenameTagInput, Tag, Tag[]>({
    mutationFn: renameTag,
    mutationKey: ["renameTag"],
    queryKey: tagKeys.all,
    dependentQueryKeys: renameTagDependentKeys(),
    successMessage: "Tag renamed",
    errorMessage: "Unable to rename tag.",
    prepareOptimisticData: (oldData, { tagId, name }) => {
      return optimisticUpdate(oldData, tagId, (t) => ({ ...t, name }));
    },
    additionalOptimisticUpdates: ({ tagId, name }) =>
      renameTagUpdates(tagId, name),
  });
}

export function useDeleteTag(_userId: string | undefined) {
  return useOptimisticMutation<DeleteTagInput, null, Tag[]>({
    mutationFn: deleteTag,
    mutationKey: ["deleteTag"],
    queryKey: tagKeys.all,
    dependentQueryKeys: deleteTagDependentKeys(),
    successMessage: "Tag deleted",
    errorMessage: "Unable to delete tag.",
    prepareOptimisticData: (oldData, { tagId }) => {
      return optimisticRemove(oldData, tagId);
    },
    additionalOptimisticUpdates: ({ tagId }) => deleteTagUpdates(tagId),
  });
}
