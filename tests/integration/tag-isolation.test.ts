import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "~/lib/data/db";
import {
  deleteTag,
  getBookmarkTags,
  getTagsWithCount,
  getUserTags,
  renameTag,
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
      .where(eq(tags.user_id, FOREIGN_USER))
      .limit(1);
    if (!foreignTag)
      throw new Error("Seed data missing: foreign user has no tags");
    foreignTagId = foreignTag.id;
    foreignTagOriginalName = foreignTag.name;

    const [foreignBookmark] = await db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(eq(bookmarks.user_id, FOREIGN_USER))
      .limit(1);
    if (!foreignBookmark)
      throw new Error("Seed data missing: foreign user has no bookmarks");
    foreignBookmarkId = foreignBookmark.id;

    const [agentBookmark] = await db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(eq(bookmarks.user_id, AGENT_USER))
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
      .where(eq(tags.user_id, AGENT_USER));
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

    it("links, reads, renames, unlinks, and deletes tags on my own bookmark", async () => {
      const db = getDb();

      const add = await upsertTag(db, AGENT_USER, `${PREFIX}mine`);
      expect(add.success).toBe(true);
      if (!add.success) return;
      const tagId = add.data.id;

      await db
        .insert(bookmarkTags)
        .values({ bookmark_id: agentBookmarkId, tag_id: tagId });

      const read = await getBookmarkTags(db, AGENT_USER, {
        bookmarkId: agentBookmarkId,
      });
      expect(read.success).toBe(true);
      if (!read.success) return;
      expect(read.data.map((t) => t.id)).toContain(tagId);

      const rename = await renameTag(db, AGENT_USER, {
        tagId,
        name: `${PREFIX}mine-renamed`,
      });
      expect(rename.success).toBe(true);
      if (!rename.success) return;
      expect(rename.data.id).toBe(tagId);
      expect(rename.data.name.toLowerCase()).toBe(`${PREFIX}mine-renamed`);

      await db
        .delete(bookmarkTags)
        .where(
          and(
            eq(bookmarkTags.bookmark_id, agentBookmarkId),
            eq(bookmarkTags.tag_id, tagId),
          ),
        );

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
