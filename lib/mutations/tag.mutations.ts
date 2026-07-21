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
  TagWithCount,
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
  const uid = userId ?? "";

  return useOptimisticMutation<AddTagToBookmarkInput, Tag>({
    mutationFn: addTagToBookmark,
    mutationKey: ["addTagToBookmark"],
    queryKey: tagKeys.all,
    dependentQueryKeys: [bookmarkKeys.all, tagKeys.links, tagKeys.withCount],
    successMessage: null,
    errorMessage: "Failed to add tag. Check the name and try again.",
    prepareOptimisticData: (oldData, { tagId, name }) => {
      const prev = (oldData as Tag[]) ?? [];
      if (!tagId && name) {
        const exists = prev.some(
          (t) => t.name.toLowerCase() === name.toLowerCase(),
        );
        if (!exists) {
          return [...prev, createTempTag(name, uid)];
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

      let tagToAdd: Tag | undefined;
      if (tagId) {
        tagToAdd = byId.get(tagId);
      } else if (name) {
        tagToAdd = byName.get(name.toLowerCase());
      }
      if (!tagToAdd) return [];
      const tag = tagToAdd;

      return [
        {
          key: tagKeys.byBookmark(bookmarkId),
          updater: (oldData) => {
            const prev = (oldData as Tag[]) ?? [];
            if (prev.some((t) => t.id === tag.id)) return prev;
            return [...prev, tag];
          },
        },
        {
          key: tagKeys.links,
          updater: (oldData) => {
            const prev = (oldData as BookmarkTagLink[]) ?? [];
            if (
              prev.some(
                (l) => l.bookmark_id === bookmarkId && l.tag_id === tag.id,
              )
            ) {
              return prev;
            }
            return [...prev, { bookmark_id: bookmarkId, tag_id: tag.id }];
          },
        },
      ];
    },
  });
}

export function useRemoveTagFromBookmark(_userId: string | undefined) {
  return useOptimisticMutation<RemoveTagFromBookmarkInput, null>({
    mutationFn: removeTagFromBookmark,
    mutationKey: ["removeTagFromBookmark"],
    queryKey: tagKeys.all,
    dependentQueryKeys: [bookmarkKeys.all, tagKeys.withCount],
    successMessage: null,
    errorMessage: "Failed to remove tag. Please try again.",
    prepareOptimisticData: (oldData) => (oldData as Tag[]) ?? [],
    additionalOptimisticUpdates: ({ bookmarkId, tagId }) => [
      {
        key: tagKeys.byBookmark(bookmarkId),
        updater: (oldData) => {
          const prev = (oldData as Tag[]) ?? [];
          return prev.filter((t) => t.id !== tagId);
        },
      },
      {
        key: tagKeys.links,
        updater: (oldData) => {
          const prev = (oldData as BookmarkTagLink[]) ?? [];
          return prev.filter(
            (l) => !(l.bookmark_id === bookmarkId && l.tag_id === tagId),
          );
        },
      },
    ],
  });
}

export function useSetBookmarkTags(userId: string | undefined) {
  const uid = userId ?? "";

  return useOptimisticMutation<SetBookmarkTagsInput, Tag[]>({
    mutationFn: setBookmarkTags,
    mutationKey: ["setBookmarkTags"],
    queryKey: tagKeys.all,
    dependentQueryKeys: [bookmarkKeys.all, tagKeys.links, tagKeys.withCount],
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

      return [
        {
          key: tagKeys.byBookmark(bookmarkId),
          updater: () => resolvedTags,
        },
        {
          key: tagKeys.links,
          updater: (oldData) => {
            const prev = (oldData as BookmarkTagLink[]) ?? [];
            const filtered = prev.filter((l) => l.bookmark_id !== bookmarkId);
            const newLinks: BookmarkTagLink[] = resolvedTags.map((t) => ({
              bookmark_id: bookmarkId,
              tag_id: t.id,
            }));
            return [...filtered, ...newLinks];
          },
        },
      ];
    },
  });
}

export function useRenameTag(_userId: string | undefined) {
  return useOptimisticMutation<RenameTagInput, Tag>({
    mutationFn: renameTag,
    mutationKey: ["renameTag"],
    queryKey: tagKeys.all,
    dependentQueryKeys: [bookmarkKeys.all, tagKeys.links],
    successMessage: "Tag renamed",
    errorMessage: "Failed to rename tag. Please try again.",
    prepareOptimisticData: (oldData, { tagId, name }) => {
      const prev = (oldData as Tag[]) ?? [];
      return prev.map((t) => (t.id === tagId ? { ...t, name } : t));
    },
    additionalOptimisticUpdates: ({ tagId, name }) => [
      {
        key: tagKeys.withCount,
        updater: (oldData) => {
          const prev = (oldData as TagWithCount[]) ?? [];
          return prev.map((t) => (t.id === tagId ? { ...t, name } : t));
        },
      },
    ],
  });
}

export function useDeleteTag(_userId: string | undefined) {
  return useOptimisticMutation<DeleteTagInput, null>({
    mutationFn: deleteTag,
    mutationKey: ["deleteTag"],
    queryKey: tagKeys.all,
    dependentQueryKeys: [bookmarkKeys.all],
    successMessage: "Tag deleted",
    errorMessage: "Failed to delete tag. Please try again.",
    prepareOptimisticData: (oldData, { tagId }) => {
      const prev = (oldData as Tag[]) ?? [];
      return prev.filter((t) => t.id !== tagId);
    },
    additionalOptimisticUpdates: ({ tagId }) => [
      {
        key: tagKeys.withCount,
        updater: (oldData) => {
          const prev = (oldData as TagWithCount[]) ?? [];
          return prev.filter((t) => t.id !== tagId);
        },
      },
      {
        key: tagKeys.links,
        updater: (oldData) => {
          const prev = (oldData as BookmarkTagLink[]) ?? [];
          return prev.filter((l) => l.tag_id !== tagId);
        },
      },
    ],
  });
}
