import type { QueryKey } from "@tanstack/react-query";

import { AdditionalOptimisticUpdate, typedUpdate } from "~/lib/mutations/base";
import { bookmarkKeys, tagKeys } from "~/lib/query-keys";

type BookmarkTagLink = { bookmark_id: string; tag_id: string };

const BY_BOOKMARK_PREFIX = (userId: string) =>
  tagKeys.bookmarkLinksPrefix(userId);

// ── useRenameTag ─────────────────────────────────────────────────
// Links are id-pairs, not names, so a rename doesn't touch tagKeys.links;
// per-bookmark caches refresh via the byBookmark prefix.

export function renameTagDependentKeys(userId: string): readonly QueryKey[] {
  return [bookmarkKeys.all(userId), BY_BOOKMARK_PREFIX(userId)];
}

export function renameTagUpdates(
  userId: string,
  tagId: string,
  name: string,
): AdditionalOptimisticUpdate[] {
  return [
    typedUpdate<{ id: string; name?: string }[]>(
      tagKeys.withCount(userId),
      (oldData) => {
        const prev = oldData ?? [];
        return prev.map((t) => (t.id === tagId ? { ...t, name } : t));
      },
    ),
  ];
}

// ── useDeleteTag ─────────────────────────────────────────────────

export function deleteTagDependentKeys(userId: string): readonly QueryKey[] {
  return [bookmarkKeys.all(userId), BY_BOOKMARK_PREFIX(userId)];
}

export function deleteTagUpdates(
  userId: string,
  tagId: string,
): AdditionalOptimisticUpdate[] {
  return [
    typedUpdate<{ id: string }[]>(tagKeys.withCount(userId), (oldData) => {
      return (oldData ?? []).filter((t) => t.id !== tagId);
    }),
    typedUpdate<BookmarkTagLink[]>(tagKeys.links(userId), (oldData) => {
      return (oldData ?? []).filter((l) => l.tag_id !== tagId);
    }),
  ];
}

// ── useUpdateBookmarkFields ──────────────────────────────────────

export function updateBookmarkFieldsDependentKeys(
  userId: string,
): readonly QueryKey[] {
  return [
    tagKeys.all(userId),
    tagKeys.links(userId),
    tagKeys.withCount(userId),
  ];
}

export function updateBookmarkFieldsUpdates(
  userId: string,
  bookmarkId: string,
  links: BookmarkTagLink[],
): AdditionalOptimisticUpdate[] {
  return [
    typedUpdate<BookmarkTagLink[]>(tagKeys.links(userId), (oldData) => {
      const prev = oldData ?? [];
      return [...prev.filter((l) => l.bookmark_id !== bookmarkId), ...links];
    }),
  ];
}
