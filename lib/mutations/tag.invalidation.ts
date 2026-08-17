import type { QueryKey } from "@tanstack/react-query";

import { AdditionalOptimisticUpdate, typedUpdate } from "~/lib/mutations/base";
import { bookmarkKeys, tagKeys } from "~/lib/query-keys";

type BookmarkTagLink = { bookmark_id: string; tag_id: string };

const BY_BOOKMARK_PREFIX = ["tags", "bookmark"] as const satisfies QueryKey;

// ── useAddTagToBookmark ──────────────────────────────────────────

export function addTagDependentKeys(): readonly QueryKey[] {
  return [bookmarkKeys.all, tagKeys.links, tagKeys.withCount] as const;
}

export function addTagUpdates(
  bookmarkId: string,
  tag: { id: string },
): AdditionalOptimisticUpdate[] {
  return [
    typedUpdate<{ id: string }[]>(tagKeys.byBookmark(bookmarkId), (oldData) => {
      const prev = oldData ?? [];
      if (prev.some((t) => t.id === tag.id)) return prev;
      return [...prev, tag];
    }),
    typedUpdate<BookmarkTagLink[]>(tagKeys.links, (oldData) => {
      const prev = oldData ?? [];
      if (
        prev.some((l) => l.bookmark_id === bookmarkId && l.tag_id === tag.id)
      ) {
        return prev;
      }
      return [...prev, { bookmark_id: bookmarkId, tag_id: tag.id }];
    }),
  ];
}

// ── useRemoveTagFromBookmark ─────────────────────────────────────

export function removeTagDependentKeys(): readonly QueryKey[] {
  return [bookmarkKeys.all, tagKeys.withCount];
}

export function removeTagUpdates(
  bookmarkId: string,
  tagId: string,
): AdditionalOptimisticUpdate[] {
  return [
    typedUpdate<{ id: string }[]>(tagKeys.byBookmark(bookmarkId), (oldData) => {
      return (oldData ?? []).filter((t) => t.id !== tagId);
    }),
    typedUpdate<BookmarkTagLink[]>(tagKeys.links, (oldData) => {
      return (oldData ?? []).filter(
        (l) => !(l.bookmark_id === bookmarkId && l.tag_id === tagId),
      );
    }),
  ];
}

// ── useSetBookmarkTags ───────────────────────────────────────────

export function setTagsDependentKeys(): readonly QueryKey[] {
  return [bookmarkKeys.all, tagKeys.links, tagKeys.withCount];
}

export function setTagsUpdates(
  bookmarkId: string,
  tags: { id: string }[],
  links: BookmarkTagLink[],
): AdditionalOptimisticUpdate[] {
  return [
    typedUpdate<{ id: string }[]>(tagKeys.byBookmark(bookmarkId), () => tags),
    typedUpdate<BookmarkTagLink[]>(tagKeys.links, (oldData) => {
      const prev = oldData ?? [];
      return [...prev.filter((l) => l.bookmark_id !== bookmarkId), ...links];
    }),
  ];
}

// ── useRenameTag ─────────────────────────────────────────────────
// Fix: tagKeys.links was unnecessary (links are id-pairs, not names).
// Fix: byBookmark prefix so all per-bookmark caches refresh (names changed).

export function renameTagDependentKeys(): readonly QueryKey[] {
  return [bookmarkKeys.all, BY_BOOKMARK_PREFIX];
}

export function renameTagUpdates(
  tagId: string,
  name: string,
): AdditionalOptimisticUpdate[] {
  return [
    typedUpdate<{ id: string; name?: string }[]>(
      tagKeys.withCount,
      (oldData) => {
        const prev = oldData ?? [];
        return prev.map((t) => (t.id === tagId ? { ...t, name } : t));
      },
    ),
  ];
}

// ── useDeleteTag ─────────────────────────────────────────────────
// Fix: added byBookmark prefix so per-bookmark caches remove deleted tag.

export function deleteTagDependentKeys(): readonly QueryKey[] {
  return [bookmarkKeys.all, BY_BOOKMARK_PREFIX];
}

export function deleteTagUpdates(tagId: string): AdditionalOptimisticUpdate[] {
  return [
    typedUpdate<{ id: string }[]>(tagKeys.withCount, (oldData) => {
      return (oldData ?? []).filter((t) => t.id !== tagId);
    }),
    typedUpdate<BookmarkTagLink[]>(tagKeys.links, (oldData) => {
      return (oldData ?? []).filter((l) => l.tag_id !== tagId);
    }),
  ];
}

// ── useUpdateBookmarkFields ──────────────────────────────────────
// Fix: added byBookmark(bookmarkId) to optimistic updates.

export function updateBookmarkFieldsDependentKeys(): readonly QueryKey[] {
  return [tagKeys.all, tagKeys.links, tagKeys.withCount];
}

export function updateBookmarkFieldsUpdates(
  bookmarkId: string,
  links: BookmarkTagLink[],
): AdditionalOptimisticUpdate[] {
  return [
    typedUpdate<BookmarkTagLink[]>(tagKeys.links, (oldData) => {
      const prev = oldData ?? [];
      return [...prev.filter((l) => l.bookmark_id !== bookmarkId), ...links];
    }),
  ];
}
