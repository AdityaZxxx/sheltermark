import type { Bookmark, BookmarkSort } from "~/lib/schemas/bookmark.schema";

export function filterBookmarksByWorkspace(
  bookmarks: Bookmark[],
  workspaceId?: string,
): Bookmark[] {
  if (!workspaceId) return bookmarks;
  return bookmarks.filter((b) => b.workspace_id === workspaceId);
}

export function filterBookmarksByTags(
  bookmarks: Bookmark[],
  selectedTagIds: string[],
  tagsByBookmarkId: Map<string, string[]>,
): Bookmark[] {
  if (selectedTagIds.length === 0) return bookmarks;
  return bookmarks.filter((b) => {
    const bookmarkTags = tagsByBookmarkId.get(b.id) ?? [];
    return selectedTagIds.every((tagId) => bookmarkTags.includes(tagId));
  });
}

export function filterBookmarksBySearch(
  bookmarks: Bookmark[],
  query: string,
  tagsByBookmarkId: Map<string, string[]>,
  tagsById: Map<string, { name: string }>,
): Bookmark[] {
  const q = query.trim().toLowerCase();
  if (!q) return bookmarks;
  return bookmarks.filter((b) => {
    if (
      (b.title || "").toLowerCase().includes(q) ||
      b.url.toLowerCase().includes(q) ||
      (b.note || "").toLowerCase().includes(q)
    ) {
      return true;
    }
    const bookmarkTagIds = tagsByBookmarkId.get(b.id) ?? [];
    for (const tagId of bookmarkTagIds) {
      const tag = tagsById.get(tagId);
      if (tag?.name?.toLowerCase().includes(q)) return true;
    }
    return false;
  });
}

export function sortBookmarks(
  bookmarks: Bookmark[],
  sort: BookmarkSort,
): Bookmark[] {
  return bookmarks.toSorted((a, b) => {
    const asc = sort.sortOrder === "asc";
    const cmp = (x: string, y: string) =>
      asc ? x.localeCompare(y) : y.localeCompare(x);
    switch (sort.sortBy) {
      case "title":
        return cmp(a.title ?? "", b.title ?? "");
      case "domain":
        return cmp(a.url, b.url);
      case "updated_at":
        return cmp(a.updated_at ?? "", b.updated_at ?? "");
      default:
        return cmp(a.created_at ?? "", b.created_at ?? "");
    }
  });
}
