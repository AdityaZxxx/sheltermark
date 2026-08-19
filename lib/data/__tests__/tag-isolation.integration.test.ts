import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "~/lib/data/drizzle";
import {
  addTagToBookmark,
  deleteTag,
  getBookmarkTags,
  getTagsWithCount,
  getUserTags,
  removeTagFromBookmark,
  renameTag,
  setBookmarkTags,
  upsertTag,
} from "~/lib/data/repositories/tag.repository";
import { bookmarkTags, bookmarks, tags } from "~/lib/data/schema";

/**
 * Live-database cross-user isolation tests.
 *
 * These run against the real Supabase database through the service-role
 * connection (RLS bypassed) — the exact posture the migrated repositories
 * operate in. They verify that every repository function enforces ownership
 * itself: passing another user's known IDs must never read, mutate, or link
 * their rows.
 */
const AGENT_USER = "52a3cabd-90dd-4019-8267-b926ffd59a6e";
const FOREIGN_USER = "8256b5a2-2c49-4e30-afd1-671c183fb7c9";

const PREFIX = "drizzle-iso-";

const HAS_DB = Boolean(process.env.DATABASE_URL);

// Needs a live Supabase database with both seeded users; skipped in CI
// without DATABASE_URL.
describe.skipIf(!HAS_DB)("tag repository — Drizzle isolation suite", () => {
  let foreignTagId: string;
  let foreignTagOriginalName: string;
  let foreignBookmarkId: string;
  let agentBookmarkId: string;

  beforeAll(async () => {
    const db = getDb();

    const [foreignTag] = await db
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(eq(tags.userId, FOREIGN_USER))
      .limit(1);
    if (!foreignTag)
      throw new Error("Seed data missing: foreign user has no tags");
    foreignTagId = foreignTag.id;
    foreignTagOriginalName = foreignTag.name;

    const [foreignBookmark] = await db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(eq(bookmarks.userId, FOREIGN_USER))
      .limit(1);
    if (!foreignBookmark)
      throw new Error("Seed data missing: foreign user has no bookmarks");
    foreignBookmarkId = foreignBookmark.id;

    const [agentBookmark] = await db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(eq(bookmarks.userId, AGENT_USER))
      .limit(1);
    if (!agentBookmark)
      throw new Error("Seed data missing: agent user has no bookmarks");
    agentBookmarkId = agentBookmark.id;
  });

  afterAll(async () => {
    const db = getDb();
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
    it("getUserTags returns only the caller's tags", async () => {
      const result = await getUserTags(getDb(), AGENT_USER);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.length).toBeGreaterThan(0);
      for (const tag of result.data) {
        expect(tag.user_id).toBe(AGENT_USER);
      }
      const names = result.data.map((t) => t.name.toLowerCase());
      expect(names).not.toContain(foreignTagOriginalName.toLowerCase());
    });

    it("getTagsWithCount returns only the caller's tags", async () => {
      const result = await getTagsWithCount(getDb(), AGENT_USER);
      expect(result.success).toBe(true);
      if (!result.success) return;
      for (const tag of result.data) {
        expect(tag.user_id).toBe(AGENT_USER);
      }
      expect(result.data.map((t) => t.id)).not.toContain(foreignTagId);
    });

    it("getBookmarkTags on another user's bookmark returns nothing and leaks no tags", async () => {
      const result = await getBookmarkTags(getDb(), AGENT_USER, {
        bookmarkId: foreignBookmarkId,
      });
      expect(result.success).toBe(true);
      if (!result.success) return;
      for (const tag of result.data) {
        expect(tag.user_id).not.toBe(FOREIGN_USER);
      }
    });

    it("addTagToBookmark cannot link my tag onto another user's bookmark", async () => {
      const mine = await upsertTag(getDb(), AGENT_USER, `${PREFIX}attack-link`);
      expect(mine.success).toBe(true);
      if (!mine.success) return;

      const result = await addTagToBookmark(getDb(), AGENT_USER, {
        bookmarkId: foreignBookmarkId,
        tagId: mine.data.id,
      });
      expect(result.success).toBe(false);

      const links = await getDb()
        .select()
        .from(bookmarkTags)
        .where(
          and(
            eq(bookmarkTags.bookmarkId, foreignBookmarkId),
            eq(bookmarkTags.tagId, mine.data.id),
          ),
        );
      expect(links).toHaveLength(0);
    });

    it("addTagToBookmark cannot link another user's tag onto my bookmark", async () => {
      const result = await addTagToBookmark(getDb(), AGENT_USER, {
        bookmarkId: agentBookmarkId,
        tagId: foreignTagId,
      });
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe("Tag not found");

      const links = await getDb()
        .select()
        .from(bookmarkTags)
        .where(
          and(
            eq(bookmarkTags.bookmarkId, agentBookmarkId),
            eq(bookmarkTags.tagId, foreignTagId),
          ),
        );
      expect(links).toHaveLength(0);
    });

    it("setBookmarkTags cannot replace another user's bookmark tags", async () => {
      const beforeLinks = await getDb()
        .select()
        .from(bookmarkTags)
        .where(eq(bookmarkTags.bookmarkId, foreignBookmarkId));

      const mine = await upsertTag(getDb(), AGENT_USER, `${PREFIX}hijack`);
      expect(mine.success).toBe(true);
      if (!mine.success) return;

      const result = await setBookmarkTags(getDb(), AGENT_USER, {
        bookmarkId: foreignBookmarkId,
        tags: [{ id: mine.data.id }],
      });
      expect(result.success).toBe(false);

      const afterLinks = await getDb()
        .select()
        .from(bookmarkTags)
        .where(eq(bookmarkTags.bookmarkId, foreignBookmarkId));
      expect(afterLinks).toEqual(beforeLinks);
    });

    it("removeTagFromBookmark cannot unlink on another user's bookmark", async () => {
      const result = await removeTagFromBookmark(getDb(), AGENT_USER, {
        bookmarkId: foreignBookmarkId,
        tagId: foreignTagId,
      });
      expect(result.success).toBe(false);
    });

    it("renameTag cannot rename another user's tag", async () => {
      const result = await renameTag(getDb(), AGENT_USER, {
        tagId: foreignTagId,
        name: `${PREFIX}pwned`,
      });
      expect(result.success).toBe(false);

      const [row] = await getDb()
        .select({ name: tags.name })
        .from(tags)
        .where(eq(tags.id, foreignTagId));
      expect(row?.name).toBe(foreignTagOriginalName);
    });

    it("deleteTag cannot delete another user's tag", async () => {
      const result = await deleteTag(getDb(), AGENT_USER, {
        tagId: foreignTagId,
      });
      // Legacy behavior: delete is silent about missing rows — what matters is
      // the foreign tag still exists afterwards.
      expect(result.success).toBe(true);

      const [row] = await getDb()
        .select({ id: tags.id })
        .from(tags)
        .where(eq(tags.id, foreignTagId));
      expect(row?.id).toBe(foreignTagId);
    });
  });

  describe("behavior parity on own rows", () => {
    it("upsertTag is case-insensitive (citext) and idempotent per user", async () => {
      const first = await upsertTag(getDb(), AGENT_USER, `${PREFIX}case`);
      const second = await upsertTag(getDb(), AGENT_USER, `${PREFIX}CASE`);

      expect(first.success && second.success).toBe(true);
      if (!first.success || !second.success) return;
      expect(second.data.id).toBe(first.data.id);
      expect(first.data.user_id).toBe(AGENT_USER);
      expect(first.data.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("rejects empty tag names", async () => {
      const result = await upsertTag(getDb(), AGENT_USER, "   ");
      expect(result).toEqual({
        success: false,
        error: "Tag name cannot be empty",
      });
    });

    it("links, reads, replaces, unlinks, and deletes tags on my own bookmark", async () => {
      const db = getDb();

      const add = await addTagToBookmark(db, AGENT_USER, {
        bookmarkId: agentBookmarkId,
        name: `${PREFIX}mine`,
      });
      expect(add.success).toBe(true);
      if (!add.success) return;
      const tagId = add.data.id;

      const read = await getBookmarkTags(db, AGENT_USER, {
        bookmarkId: agentBookmarkId,
      });
      expect(read.success).toBe(true);
      if (!read.success) return;
      expect(read.data.map((t) => t.id)).toContain(tagId);

      const set = await setBookmarkTags(db, AGENT_USER, {
        bookmarkId: agentBookmarkId,
        tags: [{ id: tagId }],
      });
      expect(set.success).toBe(true);
      if (!set.success) return;
      expect(set.data.map((t) => t.id)).toEqual([tagId]);

      const rename = await renameTag(db, AGENT_USER, {
        tagId,
        name: `${PREFIX}mine-renamed`,
      });
      expect(rename.success).toBe(true);
      if (!rename.success) return;
      expect(rename.data.id).toBe(tagId);
      expect(rename.data.name.toLowerCase()).toBe(`${PREFIX}mine-renamed`);

      const remove = await removeTagFromBookmark(db, AGENT_USER, {
        bookmarkId: agentBookmarkId,
        tagId,
      });
      expect(remove.success).toBe(true);

      const afterRemove = await getBookmarkTags(db, AGENT_USER, {
        bookmarkId: agentBookmarkId,
      });
      expect(afterRemove.success).toBe(true);
      if (afterRemove.success) {
        expect(afterRemove.data.map((t) => t.id)).not.toContain(tagId);
      }

      const del = await deleteTag(db, AGENT_USER, { tagId });
      expect(del.success).toBe(true);

      const afterDelete = await getUserTags(db, AGENT_USER);
      if (afterDelete.success) {
        expect(afterDelete.data.map((t) => t.id)).not.toContain(tagId);
      }
    });
  });
});
