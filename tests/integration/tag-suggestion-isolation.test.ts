import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import "dotenv/config";
import { and, eq, isNull, like } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { Metadata } from "~/lib/metadata/types";

import { getDb } from "~/lib/data/db";
import {
  insertBookmark,
  suggestBookmarkTagsRepo,
} from "~/lib/data/repositories/bookmark.repository";
import { bookmarks, workspaces } from "~/lib/data/schema";

/**
 * Live-database ownership/isolation tests for tag suggestions. Same posture
 * as the bookmark suite: service-role connection bypasses RLS, so the repo
 * must enforce ownership itself before any AI call. The generator is
 * injected at the repository seam — no network requests happen here.
 *
 * The rate-limit case runs last: checkRateLimit keeps an in-process
 * per-user counter shared across this file's calls, so we exhaust it
 * relative to whatever count earlier cases consumed.
 */
const AGENT_USER = "52a3cabd-90dd-4019-8267-b926ffd59a6e";
const FOREIGN_USER = "8256b5a2-2c49-4e30-afd1-671c183fb7c9";

const PREFIX = "drizzle-iso-tag-suggest-";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const fakeMeta: Metadata = {
  title: "fetched title",
  description: null,
  og_image_url: null,
  favicon_url: null,
};
const fakeFetch = async () => fakeMeta;

const mustNotCallGenerator = async () => {
  throw new Error("AI generator must not be called");
};

const failingGenerator = async (): Promise<string[]> => {
  throw new Error("provider exploded");
};

const countingGenerator = async () => ["iso-alpha", "iso-beta"];

function prefixUrl(): string {
  return `https://example.com/${PREFIX}${randomUUID()}`;
}

describe.skipIf(!HAS_DB)(
  "tag suggestion repository — Drizzle isolation suite",
  () => {
    let agentBookmarkId: string;
    let foreignBookmarkId: string;

    beforeAll(async () => {
      const db = getDb();

      const wsRows = await db
        .select({ id: workspaces.id, isDefault: workspaces.is_default })
        .from(workspaces)
        .where(
          and(
            eq(workspaces.user_id, AGENT_USER),
            isNull(workspaces.deleted_at),
          ),
        );
      const defaultWs = wsRows.find((ws) => ws.isDefault);
      if (!defaultWs)
        throw new Error(
          "Seed data missing: agent user has no default workspace",
        );

      const inserted = await insertBookmark(
        db,
        AGENT_USER,
        { url: prefixUrl(), workspaceId: defaultWs.id },
        fakeFetch,
      );
      if (!inserted.success) throw new Error("Failed to seed agent bookmark");
      agentBookmarkId = inserted.data.id;

      const [row] = await db
        .select({ id: bookmarks.id })
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.user_id, FOREIGN_USER),
            isNull(bookmarks.deleted_at),
          ),
        )
        .limit(1);
      if (!row)
        throw new Error("Seed data missing: foreign user has no bookmarks");
      foreignBookmarkId = row.id;
    });

    afterAll(async () => {
      const db = getDb();
      await db.delete(bookmarks).where(like(bookmarks.url, `${PREFIX}%`));
    });

    it("suggests tags for the owner's bookmark using injected AI", async () => {
      const result = await suggestBookmarkTagsRepo(
        getDb(),
        AGENT_USER,
        { bookmarkId: agentBookmarkId },
        countingGenerator,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.suggestions).toEqual(["iso-alpha", "iso-beta"]);
      }
    });

    it("fails without calling AI for another user's bookmark", async () => {
      const result = await suggestBookmarkTagsRepo(
        getDb(),
        AGENT_USER,
        { bookmarkId: foreignBookmarkId },
        mustNotCallGenerator,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Bookmark not found");
      }
    });

    it("fails without calling AI for a missing bookmark", async () => {
      const result = await suggestBookmarkTagsRepo(
        getDb(),
        AGENT_USER,
        { bookmarkId: randomUUID() },
        mustNotCallGenerator,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Bookmark not found");
      }
    });

    it("fails safely for an invalid bookmark ID", async () => {
      const result = await suggestBookmarkTagsRepo(
        getDb(),
        AGENT_USER,
        { bookmarkId: "not-a-uuid" },
        mustNotCallGenerator,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).not.toContain("uuid");
      }
    });

    it("returns a safe message when the AI provider fails", async () => {
      const result = await suggestBookmarkTagsRepo(
        getDb(),
        AGENT_USER,
        { bookmarkId: agentBookmarkId },
        failingGenerator,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to suggest tags");
      }
    });

    it("enforces the shared daily rate limit", async () => {
      let limited = false;
      // Exhaust whatever remains of the shared bucket for this user.
      for (let i = 0; i < 20; i++) {
        const result = await suggestBookmarkTagsRepo(
          getDb(),
          AGENT_USER,
          { bookmarkId: agentBookmarkId },
          countingGenerator,
        );
        if (!result.success && result.error.includes("Rate limit")) {
          limited = true;
          break;
        }
        expect(result.success).toBe(true);
      }
      expect(limited).toBe(true);
    });
  },
);
