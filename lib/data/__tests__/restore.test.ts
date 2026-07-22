import { describe, expect, it } from "vitest";
import { FakeDbClient } from "~/lib/data/__tests__/fake-db-client";
import { restoreBookmarks, restoreWorkspace } from "~/lib/restore";
import type { Bookmark } from "~/lib/schemas/bookmark.schema";

const USER_ID = "550e8400-e29b-41d4-a716-446655440001";
const WS_A = "550e8400-e29b-41d4-a716-446655440011";
const WS_B = "550e8400-e29b-41d4-a716-446655440012";

function trashedBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: "550e8400-e29b-41d4-a716-446655440021",
    user_id: USER_ID,
    workspace_id: WS_A,
    url: "https://example.com/restored",
    title: "Trashed",
    favicon_url: null,
    og_image_url: null,
    is_public: false,
    is_broken: false,
    broken_status: "alive",
    http_status: null,
    last_checked_at: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: null,
    deleted_at: "2026-07-10T00:00:00Z",
    note: null,
    ...overrides,
  };
}

describe("restoreBookmarks", () => {
  it("restores trashed bookmarks to their original workspace (happy path)", async () => {
    const db = new FakeDbClient({
      bookmarks: [
        trashedBookmark({
          id: "550e8400-e29b-41d4-a716-446655440021",
          url: "https://example.com/a",
          workspace_id: WS_A,
        }),
        trashedBookmark({
          id: "550e8400-e29b-41d4-a716-446655440022",
          url: "https://example.com/b",
          workspace_id: WS_A,
        }),
      ],
    });

    const result = await restoreBookmarks(db, USER_ID, {
      ids: [
        "550e8400-e29b-41d4-a716-446655440021",
        "550e8400-e29b-41d4-a716-446655440022",
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.restoredCount).toBe(2);
    expect(result.data.skippedCount).toBe(0);

    const bookmarks = db.peek("bookmarks");
    expect(bookmarks.every((b) => b.deleted_at === null)).toBe(true);
  });

  it("skips bookmarks whose URL already exists in the destination workspace", async () => {
    const db = new FakeDbClient({
      bookmarks: [
        trashedBookmark({
          id: "550e8400-e29b-41d4-a716-446655440031",
          url: "https://example.com/dup",
          workspace_id: WS_A,
        }),
        trashedBookmark({
          id: "550e8400-e29b-41d4-a716-446655440032",
          url: "https://example.com/unique",
          workspace_id: WS_A,
        }),
        // Existing (non-trashed) bookmark with the same URL in WS_A
        trashedBookmark({
          id: "550e8400-e29b-41d4-a716-446655440033",
          url: "https://example.com/dup",
          workspace_id: WS_A,
          deleted_at: null,
        }),
      ],
    });

    const result = await restoreBookmarks(db, USER_ID, {
      ids: [
        "550e8400-e29b-41d4-a716-446655440031",
        "550e8400-e29b-41d4-a716-446655440032",
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.restoredCount).toBe(1);
    expect(result.data.skippedCount).toBe(1);
  });

  it("restores a mixed batch: some restored, some skipped", async () => {
    const db = new FakeDbClient({
      bookmarks: [
        // Trashed, unique URL → restored
        trashedBookmark({
          id: "550e8400-e29b-41d4-a716-446655440041",
          url: "https://example.com/keep-1",
          workspace_id: WS_A,
        }),
        // Trashed, duplicate URL in WS_A → skipped
        trashedBookmark({
          id: "550e8400-e29b-41d4-a716-446655440042",
          url: "https://example.com/keep-dup",
          workspace_id: WS_A,
        }),
        // Trashed, unique URL in WS_B → restored
        trashedBookmark({
          id: "550e8400-e29b-41d4-a716-446655440043",
          url: "https://example.com/keep-2",
          workspace_id: WS_B,
        }),
        // Non-trashed existing in WS_A with the dup URL
        trashedBookmark({
          id: "550e8400-e29b-41d4-a716-446655440044",
          url: "https://example.com/keep-dup",
          workspace_id: WS_A,
          deleted_at: null,
        }),
      ],
    });

    const result = await restoreBookmarks(db, USER_ID, {
      ids: [
        "550e8400-e29b-41d4-a716-446655440041",
        "550e8400-e29b-41d4-a716-446655440042",
        "550e8400-e29b-41d4-a716-446655440043",
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.restoredCount).toBe(2);
    expect(result.data.skippedCount).toBe(1);
  });

  it("groups duplicate detection by workspace so same URL in different workspaces both restore", async () => {
    const db = new FakeDbClient({
      bookmarks: [
        trashedBookmark({
          id: "550e8400-e29b-41d4-a716-446655440051",
          url: "https://example.com/shared",
          workspace_id: WS_A,
        }),
        trashedBookmark({
          id: "550e8400-e29b-41d4-a716-446655440052",
          url: "https://example.com/shared",
          workspace_id: WS_B,
        }),
        // Non-trashed in WS_A with same URL → WS_A bookmark skipped, WS_B restored
        trashedBookmark({
          id: "550e8400-e29b-41d4-a716-446655440053",
          url: "https://example.com/shared",
          workspace_id: WS_A,
          deleted_at: null,
        }),
      ],
    });

    const result = await restoreBookmarks(db, USER_ID, {
      ids: [
        "550e8400-e29b-41d4-a716-446655440051",
        "550e8400-e29b-41d4-a716-446655440052",
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.restoredCount).toBe(1);
    expect(result.data.skippedCount).toBe(1);
  });

  it("restores to a specified target workspace when provided", async () => {
    const db = new FakeDbClient({
      bookmarks: [
        trashedBookmark({
          id: "550e8400-e29b-41d4-a716-446655440061",
          url: "https://example.com/move-me",
          workspace_id: WS_A,
        }),
      ],
    });

    const result = await restoreBookmarks(db, USER_ID, {
      ids: ["550e8400-e29b-41d4-a716-446655440061"],
      targetWorkspaceId: WS_B,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.restoredCount).toBe(1);

    const bookmarks = db.peek("bookmarks");
    expect(bookmarks[0]?.workspace_id).toBe(WS_B);
    expect(bookmarks[0]?.deleted_at).toBeNull();
  });

  it("returns error when no bookmarks are found to restore", async () => {
    const db = new FakeDbClient({
      bookmarks: [],
    });

    const result = await restoreBookmarks(db, USER_ID, {
      ids: ["550e8400-e29b-41d4-a716-446655440099"],
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("No bookmarks found to restore");
  });
});

describe("restoreWorkspace", () => {
  it("restores the workspace and its trashed bookmarks with no conflicts", async () => {
    const db = new FakeDbClient({
      workspaces: [
        {
          id: WS_A,
          user_id: USER_ID,
          name: "Trashed WS",
          is_default: false,
          is_public: false,
          auto_check_broken: false,
          created_at: "2026-07-01T00:00:00Z",
          updated_at: null,
          deleted_at: "2026-07-10T00:00:00Z",
        },
      ],
      bookmarks: [
        trashedBookmark({
          id: "550e8400-e29b-41d4-a716-446655440071",
          url: "https://example.com/ws-a-1",
          workspace_id: WS_A,
        }),
        trashedBookmark({
          id: "550e8400-e29b-41d4-a716-446655440072",
          url: "https://example.com/ws-a-2",
          workspace_id: WS_A,
        }),
      ],
    });

    const result = await restoreWorkspace(db, USER_ID, WS_A);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.restoredCount).toBe(2);
    expect(result.data.skippedCount).toBe(0);

    const bookmarks = db.peek("bookmarks");
    expect(bookmarks.every((b) => b.deleted_at === null)).toBe(true);
    const workspaces = db.peek("workspaces");
    expect(workspaces[0]?.deleted_at).toBeNull();
  });

  it("skips trashed bookmarks whose URL already exists (non-trashed) in the workspace", async () => {
    const db = new FakeDbClient({
      workspaces: [
        {
          id: WS_A,
          user_id: USER_ID,
          name: "Trashed WS",
          is_default: false,
          is_public: false,
          auto_check_broken: false,
          created_at: "2026-07-01T00:00:00Z",
          updated_at: null,
          deleted_at: "2026-07-10T00:00:00Z",
        },
      ],
      bookmarks: [
        trashedBookmark({
          id: "550e8400-e29b-41d4-a716-446655440081",
          url: "https://example.com/conflict",
          workspace_id: WS_A,
        }),
        trashedBookmark({
          id: "550e8400-e29b-41d4-a716-446655440082",
          url: "https://example.com/clean",
          workspace_id: WS_A,
        }),
        // Non-trashed existing bookmark with the conflicting URL
        trashedBookmark({
          id: "550e8400-e29b-41d4-a716-446655440083",
          url: "https://example.com/conflict",
          workspace_id: WS_A,
          deleted_at: null,
        }),
      ],
    });

    const result = await restoreWorkspace(db, USER_ID, WS_A);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.restoredCount).toBe(1);
    expect(result.data.skippedCount).toBe(1);
  });

  it("restores the workspace even when it has no trashed bookmarks", async () => {
    const db = new FakeDbClient({
      workspaces: [
        {
          id: WS_A,
          user_id: USER_ID,
          name: "Empty Trashed WS",
          is_default: false,
          is_public: false,
          auto_check_broken: false,
          created_at: "2026-07-01T00:00:00Z",
          updated_at: null,
          deleted_at: "2026-07-10T00:00:00Z",
        },
      ],
    });

    const result = await restoreWorkspace(db, USER_ID, WS_A);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.restoredCount).toBe(0);
    expect(result.data.skippedCount).toBe(0);

    const workspaces = db.peek("workspaces");
    expect(workspaces[0]?.deleted_at).toBeNull();
  });
});
