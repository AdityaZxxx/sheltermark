import type { QueryKey } from "@tanstack/react-query";

import { AdditionalOptimisticUpdate, typedUpdate } from "~/lib/mutations/base";
import { bookmarkKeys, tagKeys } from "~/lib/query-keys";

type BookmarkTagLink = { bookmark_id: string; tag_id: string };

const BY_BOOKMARK_PREFIX = ["tags", "bookmark"] as const satisfies QueryKey;

// ── useRenameTag ─────────────────────────────────────────────────
// Links are id-pairs, not names, so a rename doesn't touch tagKeys.links;
// per-bookmark caches refresh via the byBookmark prefix.

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
