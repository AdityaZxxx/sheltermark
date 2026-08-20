import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import "dotenv/config";
import { and, eq, inArray, isNull, like } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { Metadata } from "~/lib/metadata/types";

import { getDb } from "~/lib/data/db";
import {
  batchInsertBookmarks,
  deleteBookmarks,
  exportBookmarks,
  generateAiTitleRepo,
  getBookmarks,
  getTrashedBookmarks,
  insertBookmark,
  moveBookmarks,
  permanentDeleteBookmarks,
  refetchMetadata,
  renameBookmark,
  updateBookmarkFields,
  updateBookmarkNote,
} from "~/lib/data/repositories/bookmark.repository";
import { bookmarkTags, bookmarks, tags, workspaces } from "~/lib/data/schema";

/**
 * Live-database cross-user isolation tests for the bookmark repository.
 * Same posture as the tag/workspace suites: service-role connection bypasses
 * RLS, so every function must enforce ownership itself. Footprint is limited
 * to bookmarks whose URL and tags whose name carry the drizzle-iso- prefix,
 * cleaned in afterAll.
 *
 * insertBookmark takes an injected fetcher so no network calls happen;
 * refetchMetadata/generateAiTitle are only exercised on their not-found
 * paths, which return before any network. emptyUserTrash is deliberately NOT
 * exercised here: it hard-deletes ALL of the caller's trashed rows.
 */
const AGENT_USER = "52a3cabd-90dd-4019-8267-b926ffd59a6e";
const FOREIGN_USER = "8256b5a2-2c49-4e30-afd1-671c183fb7c9";

const PREFIX = "drizzle-iso-";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const fakeMeta: Metadata = {
  title: "fetched title",
  description: null,
  og_image_url: null,
  favicon_url: null,
};
const fakeFetch = async () => fakeMeta;

function prefixUrl(): string {
  return `https://example.com/${PREFIX}${randomUUID()}`;
}

describe.skipIf(!HAS_DB)(
  "bookmark repository — Drizzle isolation suite",
  () => {
    let foreignBookmarkId: string;
    let foreignTitle: string;
    let foreignWorkspaceId: string;
    let agentDefaultWsId: string;
    let agentOtherWsId: string;

    beforeAll(async () => {
      const db = getDb();

      const [foreignBookmark] = await db
        .select({
          id: bookmarks.id,
          title: bookmarks.title,
          workspaceId: bookmarks.workspaceId,
        })
        .from(bookmarks)
        .where(
          and(eq(bookmarks.userId, FOREIGN_USER), isNull(bookmarks.deletedAt)),
        )
        .limit(1);
      if (!foreignBookmark)
        throw new Error("Seed data missing: foreign user has no bookmarks");
      foreignBookmarkId = foreignBookmark.id;
      foreignTitle = foreignBookmark.title ?? "";
      foreignWorkspaceId = foreignBookmark.workspaceId ?? "";

      const agentWorkspaces = await db
        .select({
          id: workspaces.id,
          isDefault: workspaces.isDefault,
        })
        .from(workspaces)
        .where(
          and(eq(workspaces.userId, AGENT_USER), isNull(workspaces.deletedAt)),
        );
      const defaultWs = agentWorkspaces.find((ws) => ws.isDefault);
      const otherWs = agentWorkspaces.find((ws) => !ws.isDefault);
      if (!defaultWs || !otherWs)
        throw new Error(
          "Seed data missing: agent user needs default + one extra workspace",
        );
      agentDefaultWsId = defaultWs.id;
      agentOtherWsId = otherWs.id;
    });

    afterAll(async () => {
      const db = getDb();
      await db
        .delete(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, AGENT_USER),
            like(bookmarks.url, `${PREFIX}%`),
          ),
        );
      const agentTags = await db
        .select({ name: tags.name })
        .from(tags)
        .where(eq(tags.userId, AGENT_USER));
      const createdNames = agentTags
        .filter((t) => t.name.toLowerCase().startsWith(PREFIX))
        .map((t) => t.name);
      if (createdNames.length > 0) {
        await db.delete(tags).where(inArray(tags.name, createdNames));
      }
    });

    describe("cross-user isolation (RLS bypassed)", () => {
      it("getBookmarks returns only the caller's bookmarks", async () => {
        const result = await getBookmarks(getDb(), AGENT_USER);
        expect(result.success).toBe(true);
        if (!result.success) return;
        for (const bookmark of result.data) {
          expect(bookmark.user_id).toBe(AGENT_USER);
        }
        expect(result.data.map((b) => b.id)).not.toContain(foreignBookmarkId);
      });

      it("getBookmarks scoped to a foreign workspace returns nothing of theirs", async () => {
        const result = await getBookmarks(
          getDb(),
          AGENT_USER,
          foreignWorkspaceId,
        );
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.map((b) => b.id)).not.toContain(foreignBookmarkId);
      });

      it("getTrashedBookmarks returns only the caller's trashed bookmarks", async () => {
        const result = await getTrashedBookmarks(getDb(), AGENT_USER);
        expect(result.success).toBe(true);
        if (!result.success) return;
        for (const bookmark of result.data) {
          expect(bookmark.user_id).toBe(AGENT_USER);
        }
      });

      it("deleteBookmarks cannot soft-delete another user's bookmark", async () => {
        const result = await deleteBookmarks(getDb(), AGENT_USER, {
          ids: [foreignBookmarkId],
        });
        // Silent no-op on foreign ids, matching legacy update scoping.
        expect(result.success).toBe(true);

        const [row] = await getDb()
          .select({ deletedAt: bookmarks.deletedAt })
          .from(bookmarks)
          .where(eq(bookmarks.id, foreignBookmarkId));
        expect(row?.deletedAt ?? null).toBeNull();
      });

      it("permanentDeleteBookmarks cannot hard-delete another user's bookmark", async () => {
        const result = await permanentDeleteBookmarks(getDb(), AGENT_USER, {
          ids: [foreignBookmarkId],
        });
        expect(result.success).toBe(true);

        const [row] = await getDb()
          .select({ id: bookmarks.id })
          .from(bookmarks)
          .where(eq(bookmarks.id, foreignBookmarkId));
        expect(row?.id).toBe(foreignBookmarkId);
      });

      it("moveBookmarks cannot move another user's bookmark", async () => {
        const result = await moveBookmarks(getDb(), AGENT_USER, {
          ids: [foreignBookmarkId],
          targetWorkspaceId: agentDefaultWsId,
        });
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error).toBe("No bookmarks found to move");

        const [row] = await getDb()
          .select({ workspaceId: bookmarks.workspaceId })
          .from(bookmarks)
          .where(eq(bookmarks.id, foreignBookmarkId));
        expect(row?.workspaceId).toBe(foreignWorkspaceId);
      });

      it("renameBookmark cannot rename another user's bookmark", async () => {
        const result = await renameBookmark(getDb(), AGENT_USER, {
          id: foreignBookmarkId,
          title: `${PREFIX}pwned`,
        });
        // Silent no-op on foreign ids, matching legacy update scoping.
        expect(result.success).toBe(true);

        const [row] = await getDb()
          .select({ title: bookmarks.title })
          .from(bookmarks)
          .where(eq(bookmarks.id, foreignBookmarkId));
        expect(row?.title).toBe(foreignTitle);
      });

      it("updateBookmarkNote cannot edit another user's note", async () => {
        const result = await updateBookmarkNote(getDb(), AGENT_USER, {
          id: foreignBookmarkId,
          note: `${PREFIX}pwned-note`,
        });
        expect(result.success).toBe(true);

        const [row] = await getDb()
          .select({ note: bookmarks.note })
          .from(bookmarks)
          .where(eq(bookmarks.id, foreignBookmarkId));
        expect(row?.note ?? null).not.toBe(`${PREFIX}pwned-note`);
      });

      it("updateBookmarkFields cannot edit another user's bookmark or its tags", async () => {
        const beforeLinks = await getDb()
          .select()
          .from(bookmarkTags)
          .where(eq(bookmarkTags.bookmarkId, foreignBookmarkId));

        const result = await updateBookmarkFields(getDb(), AGENT_USER, {
          id: foreignBookmarkId,
          title: `${PREFIX}pwned`,
          note: null,
          tags: [{ name: `${PREFIX}hijack` }],
        });
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error).toBe("Bookmark not found");

        const [row] = await getDb()
          .select({ title: bookmarks.title })
          .from(bookmarks)
          .where(eq(bookmarks.id, foreignBookmarkId));
        expect(row?.title).toBe(foreignTitle);

        const afterLinks = await getDb()
          .select()
          .from(bookmarkTags)
          .where(eq(bookmarkTags.bookmarkId, foreignBookmarkId));
        expect(afterLinks).toEqual(beforeLinks);
      });

      it("refetchMetadata on another user's bookmark fails before any fetch", async () => {
        const result = await refetchMetadata(getDb(), AGENT_USER, {
          id: foreignBookmarkId,
        });
        expect(result).toEqual({ success: false, error: "Bookmark not found" });
      });

      it("generateAiTitleRepo on another user's bookmark fails before any fetch", async () => {
        const result = await generateAiTitleRepo(getDb(), AGENT_USER, {
          bookmarkId: foreignBookmarkId,
        });
        expect(result).toEqual({ success: false, error: "Bookmark not found" });
      });

      it("exportBookmarks never includes another user's bookmarks", async () => {
        const result = await exportBookmarks(getDb(), AGENT_USER, {
          format: "json",
        });
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.map((b) => b.id)).not.toContain(foreignBookmarkId);
        for (const row of result.data) {
          expect(row.workspaces?.[0]?.id).toBeDefined();
        }
      });
    });

    describe("behavior parity on own rows", () => {
      it("inserts with explicit title, detects duplicates, and links tags", async () => {
        const db = getDb();
        const url = prefixUrl();

        const inserted = await insertBookmark(
          db,
          AGENT_USER,
          {
            url,
            workspaceId: agentDefaultWsId,
            clientTitle: `${PREFIX}explicit-title`,
            tagNames: [`${PREFIX}insert-tag`],
          },
          fakeFetch,
        );
        expect(inserted.success).toBe(true);
        if (!inserted.success) return;
        // Explicit client title must win over fetched metadata.
        expect(inserted.data.title).toBe(`${PREFIX}explicit-title`);
        expect(inserted.data.user_id).toBe(AGENT_USER);
        expect(inserted.tags.map((t) => t.name.toLowerCase())).toContain(
          `${PREFIX}insert-tag`,
        );

        const duplicate = await insertBookmark(
          db,
          AGENT_USER,
          { url, workspaceId: agentDefaultWsId },
          fakeFetch,
        );
        expect(duplicate).toMatchObject({ success: false, duplicate: true });

        const metadataTitled = await insertBookmark(
          db,
          AGENT_USER,
          { url: prefixUrl(), workspaceId: agentDefaultWsId },
          fakeFetch,
        );
        expect(metadataTitled.success).toBe(true);
        if (metadataTitled.success) {
          expect(metadataTitled.data.title).toBe("fetched title");
        }
      });

      it("rename, note, move between my workspaces, trash, and hard-delete", async () => {
        const db = getDb();
        const inserted = await insertBookmark(
          db,
          AGENT_USER,
          { url: prefixUrl(), workspaceId: agentDefaultWsId },
          fakeFetch,
        );
        expect(inserted.success).toBe(true);
        if (!inserted.success) return;
        const id = inserted.data.id;

        const list = await getBookmarks(db, AGENT_USER, agentDefaultWsId);
        expect(list.success).toBe(true);
        if (list.success) {
          expect(list.data.map((b) => b.id)).toContain(id);
        }

        const renamed = await renameBookmark(db, AGENT_USER, {
          id,
          title: `${PREFIX}renamed`,
        });
        expect(renamed.success).toBe(true);

        const noted = await updateBookmarkNote(db, AGENT_USER, {
          id,
          note: `${PREFIX}note`,
        });
        expect(noted.success).toBe(true);

        const edited = await updateBookmarkFields(db, AGENT_USER, {
          id,
          title: `${PREFIX}edited`,
          note: null,
          tags: [{ name: `${PREFIX}edit-tag` }],
        });
        expect(edited.success).toBe(true);
        if (edited.success) {
          expect(edited.data.map((t) => t.name.toLowerCase())).toContain(
            `${PREFIX}edit-tag`,
          );
        }

        const [row] = await db
          .select({
            title: bookmarks.title,
            note: bookmarks.note,
            workspaceId: bookmarks.workspaceId,
          })
          .from(bookmarks)
          .where(eq(bookmarks.id, id));
        expect(row?.title).toBe(`${PREFIX}edited`);
        expect(row?.note ?? null).toBeNull();

        const moved = await moveBookmarks(db, AGENT_USER, {
          ids: [id],
          targetWorkspaceId: agentOtherWsId,
        });
        expect(moved).toEqual({
          success: true,
          data: { movedCount: 1, skippedCount: 0 },
        });
        const [afterMove] = await db
          .select({ workspaceId: bookmarks.workspaceId })
          .from(bookmarks)
          .where(eq(bookmarks.id, id));
        expect(afterMove?.workspaceId).toBe(agentOtherWsId);

        const trashed = await deleteBookmarks(db, AGENT_USER, { ids: [id] });
        expect(trashed.success).toBe(true);
        const trashList = await getTrashedBookmarks(db, AGENT_USER);
        expect(trashList.success).toBe(true);
        if (trashList.success) {
          expect(trashList.data.map((b) => b.id)).toContain(id);
        }

        const gone = await permanentDeleteBookmarks(db, AGENT_USER, {
          ids: [id],
        });
        expect(gone.success).toBe(true);
        const [afterDelete] = await db
          .select({ id: bookmarks.id })
          .from(bookmarks)
          .where(eq(bookmarks.id, id));
        expect(afterDelete).toBeUndefined();
      });

      it("batchInsertBookmarks skips duplicates within the workspace", async () => {
        const db = getDb();
        const url = prefixUrl();
        const batch = [{ url, title: `${PREFIX}batch` }];

        const first = await batchInsertBookmarks(
          db,
          AGENT_USER,
          agentDefaultWsId,
          batch,
        );
        expect(first.success).toBe(true);
        if (first.success) {
          expect(first.data.imported).toBe(1);
        }

        const second = await batchInsertBookmarks(
          db,
          AGENT_USER,
          agentDefaultWsId,
          batch,
        );
        expect(second.success).toBe(true);
        if (second.success) {
          expect(second.data.imported).toBe(0);
          expect(second.data.skipped).toBe(1);
        }

        const invalid = await batchInsertBookmarks(
          db,
          AGENT_USER,
          agentDefaultWsId,
          [{ url: "not-a-url", title: "bad" }],
        );
        expect(invalid.success).toBe(true);
        if (invalid.success) {
          expect(invalid.data.errors.length).toBe(1);
        }
      });

      it("exportBookmarks includes own workspaced bookmarks", async () => {
        const db = getDb();
        const inserted = await insertBookmark(
          db,
          AGENT_USER,
          { url: prefixUrl(), workspaceId: agentDefaultWsId },
          fakeFetch,
        );
        expect(inserted.success).toBe(true);
        if (!inserted.success) return;

        const result = await exportBookmarks(db, AGENT_USER, {
          format: "json",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.map((b) => b.id)).toContain(inserted.data.id);
        }
      });
    });
  },
);
