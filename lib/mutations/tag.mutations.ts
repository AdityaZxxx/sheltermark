import type {
  AddTagToBookmarkInput,
  DeleteTagInput,
  RemoveTagFromBookmarkInput,
  RenameTagInput,
  SetBookmarkTagsInput,
  Tag,
} from "~/lib/schemas/tag.schema";

import {
  addTagToBookmark,
  deleteTag,
  removeTagFromBookmark,
  renameTag,
  setBookmarkTags,
} from "~/app/action/tag.action";
import {
  optimisticRemove,
  optimisticUpdate,
  useOptimisticMutation,
} from "~/lib/mutations/base";
import {
  addTagDependentKeys,
  addTagUpdates,
  deleteTagDependentKeys,
  deleteTagUpdates,
  removeTagDependentKeys,
  removeTagUpdates,
  renameTagDependentKeys,
  renameTagUpdates,
  setTagsDependentKeys,
  setTagsUpdates,
} from "~/lib/mutations/tag.invalidation";
import { tagKeys } from "~/lib/query-keys";

type BookmarkTagLink = { bookmark_id: string; tag_id: string };

const generateTempId = () =>
  `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function createTempTag(name: string, userId: string): Tag {
  return {
    id: generateTempId(),
    user_id: userId,
    name,
    created_at: new Date().toISOString(),
  };
}

function resolveTagsFromLibrary(
  tags: SetBookmarkTagsInput["tags"],
  userTags: Tag[],
  userId: string,
): Tag[] {
  const byId = new Map(userTags.map((t) => [t.id, t]));
  const byName = new Map(userTags.map((t) => [t.name.toLowerCase(), t]));
  return tags.map((entry) => {
    if (entry.id && byId.has(entry.id)) {
      // SAFETY: byId.has(entry.id) guarantees the Map lookup succeeds.
      return byId.get(entry.id) as Tag;
    }
    if (entry.name) {
      const match = byName.get(entry.name.toLowerCase());
      if (match) return match;
    }
    return createTempTag(entry.name ?? "Untitled", userId);
  });
}

export function useAddTagToBookmark(userId: string | undefined) {
  return useOptimisticMutation<AddTagToBookmarkInput, Tag, Tag[]>({
    mutationFn: addTagToBookmark,
    mutationKey: ["addTagToBookmark"],
    queryKey: tagKeys.all,
    dependentQueryKeys: addTagDependentKeys(),
    successMessage: null,
    errorMessage: "Failed to add tag. Check the name and try again.",
    prepareOptimisticData: (oldData, { tagId, name }) => {
      const prev = oldData ?? [];
      if (!tagId && name) {
        const exists = prev.some(
          (t) => t.name.toLowerCase() === name.toLowerCase(),
        );
        if (!exists) {
          return [...prev, createTempTag(name, userId ?? "")];
        }
      }
      return prev;
    },
    additionalOptimisticUpdates: (
      { bookmarkId, tagId, name },
      optimisticPrimary,
    ) => {
      const userTags = optimisticPrimary;
      const byId = new Map(userTags.map((t) => [t.id, t]));
      const byName = new Map(userTags.map((t) => [t.name.toLowerCase(), t]));

      const tag = tagId
        ? byId.get(tagId)
        : name
          ? byName.get(name.toLowerCase())
          : undefined;
      if (!tag) return [];
      return addTagUpdates(bookmarkId, tag);
    },
  });
}

export function useRemoveTagFromBookmark(_userId: string | undefined) {
  return useOptimisticMutation<RemoveTagFromBookmarkInput, null, Tag[]>({
    mutationFn: removeTagFromBookmark,
    mutationKey: ["removeTagFromBookmark"],
    queryKey: tagKeys.all,
    dependentQueryKeys: removeTagDependentKeys(),
    successMessage: null,
    errorMessage: "Failed to remove tag. Please try again.",
    prepareOptimisticData: (oldData) => oldData ?? [],
    additionalOptimisticUpdates: ({ bookmarkId, tagId }) =>
      removeTagUpdates(bookmarkId, tagId),
  });
}

export function useSetBookmarkTags(userId: string | undefined) {
  const uid = userId ?? "";

  return useOptimisticMutation<SetBookmarkTagsInput, Tag[], Tag[]>({
    mutationFn: setBookmarkTags,
    mutationKey: ["setBookmarkTags"],
    queryKey: tagKeys.all,
    dependentQueryKeys: setTagsDependentKeys(),
    successMessage: "Tags updated",
    errorMessage: "Failed to update tags. Please try again.",
    prepareOptimisticData: (oldData, { tags }) => {
      const prev = oldData ?? [];
      const existingNames = new Set(prev.map((t) => t.name.toLowerCase()));
      const newTags: Tag[] = [];
      for (const entry of tags) {
        if (entry.id) continue;
        if (!entry.name) continue;
        if (existingNames.has(entry.name.toLowerCase())) continue;
        newTags.push(createTempTag(entry.name, uid));
      }
      return newTags.length > 0 ? [...prev, ...newTags] : prev;
    },
    additionalOptimisticUpdates: ({ bookmarkId, tags }, optimisticPrimary) => {
      const userTags = optimisticPrimary;
      const resolvedTags = resolveTagsFromLibrary(tags, userTags, uid);
      const links: BookmarkTagLink[] = resolvedTags.map((t) => ({
        bookmark_id: bookmarkId,
        tag_id: t.id,
      }));
      return setTagsUpdates(bookmarkId, resolvedTags, links);
    },
  });
}

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
