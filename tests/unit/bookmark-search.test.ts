import { describe, expect, it } from "bun:test";

import type { Bookmark } from "~/lib/schemas/bookmark.schema";

import {
  buildBookmarkSearchIndex,
  filterBookmarksBySearch,
} from "~/lib/queries/bookmark-filters";

const tagsByBookmarkId = new Map([
  ["bm-1", ["tag-react", "tag-css"]],
  ["bm-2", ["tag-rust"]],
  ["bm-3", []],
]);

const tagsById = new Map([
  ["tag-react", { name: "React" }],
  ["tag-css", { name: "CSS" }],
  ["tag-rust", { name: "Rust" }],
]);

// SAFETY: fixtures only populate the fields the search path reads
// (id/title/url/note/workspace_id); the rest of Bookmark is irrelevant here.
const asBookmark = (
  b: Partial<Bookmark> & Pick<Bookmark, "id" | "url">,
): Bookmark => b as Bookmark;

const bookmarks: Bookmark[] = [
  asBookmark({
    id: "bm-1",
    title: "React docs",
    url: "https://react.dev",
    note: "hooks reference",
  }),
  asBookmark({
    id: "bm-2",
    title: "Rust book",
    url: "https://doc.rust-lang.org",
  }),
  asBookmark({
    id: "bm-3",
    title: "Tailwind",
    url: "https://tailwindcss.com",
    note: "utility CSS framework",
  }),
];

const index = buildBookmarkSearchIndex(bookmarks, tagsByBookmarkId, tagsById);

describe("filterBookmarksBySearch", () => {
  it("matches a single keyword across any field including tag names", () => {
    expect(filterBookmarksBySearch(bookmarks, "rust", index)).toHaveLength(1);
    expect(filterBookmarksBySearch(bookmarks, "react", index)).toHaveLength(1);
    expect(filterBookmarksBySearch(bookmarks, "css", index)).toHaveLength(2);
  });

  it("requires every keyword to match, across different fields", () => {
    expect(filterBookmarksBySearch(bookmarks, "react hooks", index)).toEqual([
      bookmarks[0]!,
    ]);
    expect(
      filterBookmarksBySearch(bookmarks, "react rust", index),
    ).toHaveLength(0);
  });

  it("is case-insensitive and collapses whitespace", () => {
    expect(
      filterBookmarksBySearch(bookmarks, "  REACT   HOOKS ", index),
    ).toEqual([bookmarks[0]!]);
  });

  it("returns everything for blank queries", () => {
    expect(filterBookmarksBySearch(bookmarks, "", index)).toBe(bookmarks);
    expect(filterBookmarksBySearch(bookmarks, "   ", index)).toBe(bookmarks);
  });

  it("matches workspace name only when the index includes it (dashboard scope)", () => {
    const scoped: Bookmark[] = [
      asBookmark({ ...bookmarks[0]!, workspace_id: "ws-work" }),
      asBookmark({ ...bookmarks[1]!, workspace_id: null }),
    ];
    const wsNames = new Map([["ws-work", "Work Stuff"]]);
    const wsIndex = buildBookmarkSearchIndex(
      scoped,
      tagsByBookmarkId,
      tagsById,
      wsNames,
    );

    expect(filterBookmarksBySearch(scoped, "work stuff", wsIndex)).toEqual([
      scoped[0]!,
    ]);
    // Workspace-name keyword combines with content keywords across fields.
    expect(filterBookmarksBySearch(scoped, "docs work", wsIndex)).toEqual([
      scoped[0]!,
    ]);
    expect(filterBookmarksBySearch(scoped, "rust work", wsIndex)).toHaveLength(
      0,
    );
  });

  it("excludes workspace names when the index omits them (workspace scope)", () => {
    expect(filterBookmarksBySearch(bookmarks, "archive", index)).toHaveLength(
      0,
    );
  });
});
