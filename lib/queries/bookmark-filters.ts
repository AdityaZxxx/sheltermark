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

export type BookmarkSearchIndex = Map<string, string>;

export function buildBookmarkSearchIndex(
  bookmarks: Bookmark[],
  tagsByBookmarkId: Map<string, string[]>,
  tagsById: Map<string, { name: string }>,
  // Only provided when searching across all workspaces (dashboard) —
  // inside a single workspace the name is constant and adds noise.
  workspaceNameById?: Map<string, string>,
): BookmarkSearchIndex {
  const index = new Map<string, string>();
  for (const b of bookmarks) {
    const tagNames = (tagsByBookmarkId.get(b.id) ?? [])
      .map((id) => tagsById.get(id)?.name ?? "")
      .join("\n");
    const wsName = b.workspace_id
      ? (workspaceNameById?.get(b.workspace_id) ?? "")
      : "";
    index.set(
      b.id,
      `${b.title || ""}\n${b.url}\n${b.note || ""}\n${tagNames}\n${wsName}`.toLowerCase(),
    );
  }
  return index;
}

export function filterBookmarksBySearch(
  bookmarks: Bookmark[],
  query: string,
  index: BookmarkSearchIndex,
): Bookmark[] {
  // Every whitespace-separated keyword must match somewhere across
  // title/URL/note/tag names; keywords may hit different fields.
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return bookmarks;
  return bookmarks.filter((b) => {
    const haystack = index.get(b.id);
    if (!haystack) return false;
    return tokens.every((token) => haystack.includes(token));
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
