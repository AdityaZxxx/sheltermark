import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "bun:test";

import {
  deleteTagDependentKeys,
  deleteTagUpdates,
  renameTagDependentKeys,
  renameTagUpdates,
  updateBookmarkFieldsDependentKeys,
  updateBookmarkFieldsUpdates,
} from "~/lib/mutations/tag.invalidation";
import { bookmarkKeys, tagKeys } from "~/lib/query-keys";

const TAG_ID_A = "tag-a-0000-0000-0000-000000000001";
const TAG_ID_B = "tag-a-0000-0000-0000-000000000002";
const BM_ID = "bm-0000-0000-0000-000000000001";

const MONOSPACE_PREFIX = ["tags", "bookmark"];

function clientWith(
  entries: Array<[readonly unknown[], unknown]>,
): QueryClient {
  const client = new QueryClient();
  for (const [key, data] of entries) {
    // SAFETY: keys are test-local const arrays, never mutated;
    // setQueryData requires a mutable QueryKey.
    client.setQueryData(key as unknown[], data);
  }
  return client;
}

// ── renameTag ────────────────────────────────────────────────────

describe("renameTagDependentKeys", () => {
  it("includes bookmark.all and byBookmark prefix (not tagKeys.links)", () => {
    const keys = renameTagDependentKeys();
    expect(keys).toContainEqual(bookmarkKeys.all);
    expect(keys).toContainEqual(MONOSPACE_PREFIX);
    expect(keys).not.toContainEqual(tagKeys.links);
  });
});

describe("renameTagUpdates", () => {
  it("updates the tag name in withCount list", () => {
    const updates = renameTagUpdates(TAG_ID_A, "new-name");
    const client = clientWith([
      [
        tagKeys.withCount,
        [
          { id: TAG_ID_A, name: "old-name" },
          { id: TAG_ID_B, name: "other" },
        ],
      ],
    ]);
    updates[0]!.apply(client);
    expect<unknown>(client.getQueryData(tagKeys.withCount)).toEqual([
      { id: TAG_ID_A, name: "new-name" },
      { id: TAG_ID_B, name: "other" },
    ]);
  });
});

// ── deleteTag ────────────────────────────────────────────────────

describe("deleteTagDependentKeys", () => {
  it("includes bookmark.all and byBookmark prefix", () => {
    const keys = deleteTagDependentKeys();
    expect(keys).toContainEqual(bookmarkKeys.all);
    expect(keys).toContainEqual(MONOSPACE_PREFIX);
  });
});

describe("deleteTagUpdates", () => {
  it("removes tag from withCount list", () => {
    const updates = deleteTagUpdates(TAG_ID_A);
    const client = clientWith([
      [
        tagKeys.withCount,
        [
          { id: TAG_ID_A, name: "gone" },
          { id: TAG_ID_B, name: "kept" },
        ],
      ],
    ]);
    updates[0]!.apply(client);
    expect<unknown>(client.getQueryData(tagKeys.withCount)).toEqual([
      { id: TAG_ID_B, name: "kept" },
    ]);
  });

  it("removes all links for the deleted tag", () => {
    const updates = deleteTagUpdates(TAG_ID_A);
    const client = clientWith([
      [
        tagKeys.links,
        [
          { bookmark_id: BM_ID, tag_id: TAG_ID_A },
          { bookmark_id: "other", tag_id: TAG_ID_A },
          { bookmark_id: BM_ID, tag_id: TAG_ID_B },
        ],
      ],
    ]);
    updates[1]!.apply(client);
    expect<unknown>(client.getQueryData(tagKeys.links)).toEqual([
      { bookmark_id: BM_ID, tag_id: TAG_ID_B },
    ]);
  });
});

// ── updateBookmarkFields ─────────────────────────────────────────

describe("updateBookmarkFieldsDependentKeys", () => {
  it("returns tag.all, tag links, and tag withCount", () => {
    expect(updateBookmarkFieldsDependentKeys()).toEqual([
      tagKeys.all,
      tagKeys.links,
      tagKeys.withCount,
    ]);
  });
});

describe("updateBookmarkFieldsUpdates", () => {
  it("replaces links for the bookmark in tagKeys.links", () => {
    const newLinks = [{ bookmark_id: BM_ID, tag_id: TAG_ID_A }];
    const updates = updateBookmarkFieldsUpdates(BM_ID, newLinks);
    const client = clientWith([
      [
        tagKeys.links,
        [
          { bookmark_id: BM_ID, tag_id: "old-tag" },
          { bookmark_id: "other", tag_id: "other-tag" },
        ],
      ],
    ]);
    updates[0]!.apply(client);
    expect<unknown>(client.getQueryData(tagKeys.links)).toEqual([
      { bookmark_id: "other", tag_id: "other-tag" },
      { bookmark_id: BM_ID, tag_id: TAG_ID_A },
    ]);
  });
});

// ── edge cases ───────────────────────────────────────────────────

describe("tag-cache edge cases", () => {
  it("all updaters handle empty cache entries", () => {
    const empty = new QueryClient();

    renameTagUpdates(TAG_ID_A, "x")[0]!.apply(empty);
    expect<unknown>(empty.getQueryData(tagKeys.withCount)).toEqual([]);

    deleteTagUpdates(TAG_ID_A)[0]!.apply(empty);
    expect<unknown>(empty.getQueryData(tagKeys.withCount)).toEqual([]);

    updateBookmarkFieldsUpdates(BM_ID, [])[0]!.apply(empty);
    expect<unknown>(empty.getQueryData(tagKeys.links)).toEqual([]);
  });
});
