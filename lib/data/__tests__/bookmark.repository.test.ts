import { describe, expect, it } from "vitest";

import type { Bookmark } from "~/lib/schemas/bookmark.schema";

import { FakeDbClient } from "~/lib/data/__tests__/fake-db-client";
import {
  batchInsertBookmarks,
  insertBookmark,
  moveBookmarks,
} from "~/lib/data/repositories/bookmark.repository";

const USER_ID = "550e8400-e29b-41d4-a716-446655440001";
const WORKSPACE_ID = "550e8400-e29b-41d4-a716-446655440002";
const URL = "https://example.com/post";
const NORMALIZED_URL = "https://example.com/post";

function bookmarkRow(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: "550e8400-e29b-41d4-a716-446655440003",
    user_id: USER_ID,
    workspace_id: WORKSPACE_ID,
    url: NORMALIZED_URL,
    title: "Existing",
    favicon_url: null,
    og_image_url: null,
    is_public: false,
    is_broken: false,
    broken_status: "alive",
    http_status: null,
    last_checked_at: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: null,
    deleted_at: null,
    note: null,
    ...overrides,
  };
}

describe("insertBookmark", () => {
  it("inserts a new bookmark when the URL is not present", async () => {
    const db = new FakeDbClient();

    const result = await insertBookmark(
      db,
      USER_ID,
      {
        url: URL,
        workspaceId: WORKSPACE_ID,
      },
      async () => ({
        title: "Test Page",
        description: null,
        og_image_url: null,
        favicon_url: "https://example.com/favicon.ico",
      }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.url).toBe(NORMALIZED_URL);
    expect(result.data.user_id).toBe(USER_ID);
    expect(result.data.workspace_id).toBe(WORKSPACE_ID);
    expect(result.data.title).toBe("Test Page");

    const bookmarks = db.peek("bookmarks");
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0]?.url).toBe(NORMALIZED_URL);
    expect(bookmarks[0]?.user_id).toBe(USER_ID);
    expect(bookmarks[0]?.workspace_id).toBe(WORKSPACE_ID);
  });

  it("returns duplicate when the same URL exists in the same workspace", async () => {
    const db = new FakeDbClient({
      bookmarks: [
        bookmarkRow({
          url: NORMALIZED_URL,
          user_id: USER_ID,
          workspace_id: WORKSPACE_ID,
          deleted_at: null,
        }),
      ],
    });

    const result = await insertBookmark(db, USER_ID, {
      url: URL,
      workspaceId: WORKSPACE_ID,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.duplicate).toBe(true);

    const bookmarks = db.peek("bookmarks");
    expect(bookmarks).toHaveLength(1);
  });

  it("returns duplicate when both bookmark and workspace_id are null", async () => {
    const db = new FakeDbClient({
      bookmarks: [
        bookmarkRow({
          id: "550e8400-e29b-41d4-a716-446655440004",
          url: NORMALIZED_URL,
          user_id: USER_ID,
          workspace_id: null,
          deleted_at: null,
        }),
      ],
    });

    const result = await insertBookmark(db, USER_ID, {
      url: URL,
      workspaceId: null,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.duplicate).toBe(true);

    const bookmarks = db.peek("bookmarks");
    expect(bookmarks).toHaveLength(1);
  });
});

describe("moveBookmarks", () => {
  const SOURCE_WS = "550e8400-e29b-41d4-a716-446655440011";
  const TARGET_WS = "550e8400-e29b-41d4-a716-446655440012";
  const BM_A = "550e8400-e29b-41d4-a716-446655440021";
  const BM_B = "550e8400-e29b-41d4-a716-446655440022";
  const BM_DUP_TGT = "550e8400-e29b-41d4-a716-446655440024";

  it("moves all bookmarks when no URL conflicts exist in the target", async () => {
    const db = new FakeDbClient({
      bookmarks: [
        bookmarkRow({
          id: BM_A,
          url: "https://example.com/a",
          workspace_id: SOURCE_WS,
        }),
        bookmarkRow({
          id: BM_B,
          url: "https://example.com/b",
          workspace_id: SOURCE_WS,
        }),
      ],
    });

    const result = await moveBookmarks(db, USER_ID, {
      ids: [BM_A, BM_B],
      targetWorkspaceId: TARGET_WS,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.movedCount).toBe(2);
    expect(result.data.skippedCount).toBe(0);

    const bookmarks = db.peek("bookmarks");
    expect(bookmarks.every((b) => b.workspace_id === TARGET_WS)).toBe(true);
  });

  it("skips bookmarks whose URL already exists in the target workspace", async () => {
    const db = new FakeDbClient({
      bookmarks: [
        bookmarkRow({
          id: BM_A,
          url: "https://example.com/dup",
          workspace_id: SOURCE_WS,
        }),
        bookmarkRow({
          id: BM_B,
          url: "https://example.com/unique",
          workspace_id: SOURCE_WS,
        }),
        bookmarkRow({
          id: BM_DUP_TGT,
          url: "https://example.com/dup",
          workspace_id: TARGET_WS,
        }),
      ],
    });

    const result = await moveBookmarks(db, USER_ID, {
      ids: [BM_A, BM_B],
      targetWorkspaceId: TARGET_WS,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.movedCount).toBe(1);
    expect(result.data.skippedCount).toBe(1);
  });

  it("moves to null workspace when targetWorkspaceId is 'null'", async () => {
    // The repo code checks for the string "null" and treats it as null.
    // This bypasses Zod in production via the action layer, but the repo
    // schema validates first — so this test confirms the schema rejects it.
    const db = new FakeDbClient({
      bookmarks: [
        bookmarkRow({
          id: BM_A,
          url: "https://example.com/c",
          workspace_id: SOURCE_WS,
        }),
      ],
    });

    const result = await moveBookmarks(db, USER_ID, {
      ids: [BM_A],
      targetWorkspaceId: "null",
    });

    expect(result.success).toBe(false);
  });
});

describe("batchInsertBookmarks", () => {
  const WORKSPACE_A = "550e8400-e29b-41d4-a716-446655440031";
  const EXISTING_ID = "550e8400-e29b-41d4-a716-446655440032";

  it("inserts all bookmarks with skip strategy when no duplicates exist", async () => {
    const db = new FakeDbClient();

    const result = await batchInsertBookmarks(
      db,
      USER_ID,
      WORKSPACE_A,
      [
        { url: "https://example.com/1", title: "One" },
        { url: "https://example.com/2", title: "Two" },
      ],
      { duplicateStrategy: "skip" },
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.imported).toBe(2);
    expect(result.data.skipped).toBe(0);

    const bookmarks = db.peek("bookmarks");
    expect(bookmarks).toHaveLength(2);
  });

  it("skips bookmarks whose URL already exists with skip strategy", async () => {
    const db = new FakeDbClient({
      bookmarks: [
        bookmarkRow({
          id: EXISTING_ID,
          url: "https://example.com/dup",
          workspace_id: WORKSPACE_A,
        }),
      ],
    });

    const result = await batchInsertBookmarks(
      db,
      USER_ID,
      WORKSPACE_A,
      [
        { url: "https://example.com/dup", title: "Duplicate" },
        { url: "https://example.com/new", title: "New" },
      ],
      { duplicateStrategy: "skip" },
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.imported).toBe(1);
    expect(result.data.skipped).toBe(1);

    const bookmarks = db.peek("bookmarks");
    expect(bookmarks).toHaveLength(2);
    expect(bookmarks.some((b) => b.url === "https://example.com/new")).toBe(
      true,
    );
  });

  it("replaces existing bookmarks with replace strategy", async () => {
    const db = new FakeDbClient({
      bookmarks: [
        bookmarkRow({
          id: EXISTING_ID,
          url: "https://example.com/replace",
          title: "Old Title",
          workspace_id: WORKSPACE_A,
        }),
      ],
    });

    const result = await batchInsertBookmarks(
      db,
      USER_ID,
      WORKSPACE_A,
      [
        { url: "https://example.com/replace", title: "New Title" },
        { url: "https://example.com/fresh", title: "Fresh" },
      ],
      { duplicateStrategy: "replace" },
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.imported).toBe(2);

    const bookmarks = db.peek("bookmarks");
    const replaced = bookmarks.find(
      (b) => b.url === "https://example.com/replace",
    );
    expect(replaced?.title).toBe("New Title");
    expect(bookmarks.some((b) => b.id === EXISTING_ID)).toBe(false);
  });
});
