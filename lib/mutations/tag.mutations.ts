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
import type {
  AddTagToBookmarkInput,
  DeleteTagInput,
  RemoveTagFromBookmarkInput,
  RenameTagInput,
  SetBookmarkTagsInput,
  Tag,
} from "~/lib/schemas/tag.schema";

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
  return useOptimisticMutation<AddTagToBookmarkInput, Tag>({
    mutationFn: addTagToBookmark,
    mutationKey: ["addTagToBookmark"],
    queryKey: tagKeys.all,
    dependentQueryKeys: addTagDependentKeys(),
    successMessage: null,
    errorMessage: "Failed to add tag. Check the name and try again.",
    prepareOptimisticData: (oldData, { tagId, name }) => {
      const prev = (oldData as Tag[]) ?? [];
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
      const userTags = (optimisticPrimary as Tag[]) ?? [];
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
  return useOptimisticMutation<RemoveTagFromBookmarkInput, null>({
    mutationFn: removeTagFromBookmark,
    mutationKey: ["removeTagFromBookmark"],
    queryKey: tagKeys.all,
    dependentQueryKeys: removeTagDependentKeys(),
    successMessage: null,
    errorMessage: "Failed to remove tag. Please try again.",
    prepareOptimisticData: (oldData) => (oldData as Tag[]) ?? [],
    additionalOptimisticUpdates: ({ bookmarkId, tagId }) =>
      removeTagUpdates(bookmarkId, tagId),
  });
}

export function useSetBookmarkTags(userId: string | undefined) {
  const uid = userId ?? "";

  return useOptimisticMutation<SetBookmarkTagsInput, Tag[]>({
    mutationFn: setBookmarkTags,
    mutationKey: ["setBookmarkTags"],
    queryKey: tagKeys.all,
    dependentQueryKeys: setTagsDependentKeys(),
    successMessage: "Tags updated",
    errorMessage: "Failed to update tags. Please try again.",
    prepareOptimisticData: (oldData, { tags }) => {
      const prev = (oldData as Tag[]) ?? [];
      const existingNames = new Set(prev.map((t) => t.name.toLowerCase()));
      const newTags: Tag[] = [];
      for (const entry of tags) {
        if (entry.id) continue;
        if (typeof entry.name !== "string" || entry.name.length === 0) continue;
        if (existingNames.has(entry.name.toLowerCase())) continue;
        newTags.push(createTempTag(entry.name, uid));
      }
      return newTags.length > 0 ? [...prev, ...newTags] : prev;
    },
    additionalOptimisticUpdates: ({ bookmarkId, tags }, optimisticPrimary) => {
      const userTags = (optimisticPrimary as Tag[]) ?? [];
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
  return useOptimisticMutation<RenameTagInput, Tag>({
    mutationFn: renameTag,
    mutationKey: ["renameTag"],
    queryKey: tagKeys.all,
    dependentQueryKeys: renameTagDependentKeys(),
    successMessage: "Tag renamed",
    errorMessage: "Failed to rename tag. Please try again.",
    prepareOptimisticData: (oldData, { tagId, name }) => {
      return optimisticUpdate<Tag>(oldData, tagId, (t) => ({ ...t, name }));
    },
    additionalOptimisticUpdates: ({ tagId, name }) =>
      renameTagUpdates(tagId, name),
  });
}

export function useDeleteTag(_userId: string | undefined) {
  return useOptimisticMutation<DeleteTagInput, null>({
    mutationFn: deleteTag,
    mutationKey: ["deleteTag"],
    queryKey: tagKeys.all,
    dependentQueryKeys: deleteTagDependentKeys(),
    successMessage: "Tag deleted",
    errorMessage: "Failed to delete tag. Please try again.",
    prepareOptimisticData: (oldData, { tagId }) => {
      return optimisticRemove<Tag>(oldData, tagId);
    },
    additionalOptimisticUpdates: ({ tagId }) => deleteTagUpdates(tagId),
  });
}
