import "dotenv/config";
import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";

import { getDb } from "~/lib/data/db";
import {
  deleteFeed,
  getFeeds,
  refreshFeed,
} from "~/lib/data/repositories/feed.repository";
import { feeds } from "~/lib/data/schema";

/**
 * Live-database cross-user isolation tests for the feed repository.
 * Same posture as the other suites: service-role connection bypasses RLS, so
 * every function must enforce ownership itself.
 *
 * Only non-network paths are exercised here. subscribeToFeed, syncAllFeeds,
 * and a successful refreshFeed all fetch feeds live, so they are out of
 * scope; refreshFeed is tested on its foreign-id path, which rejects before
 * any fetch. Nothing is written, so no cleanup is needed.
 */
const AGENT_USER = "52a3cabd-90dd-4019-8267-b926ffd59a6e";
const FOREIGN_USER = "8256b5a2-2c49-4e30-afd1-671c183fb7c9";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("feed repository — Drizzle isolation suite", () => {
  async function getForeignFeed(): Promise<{
    id: string;
    lastSyncedAt: string | null;
  }> {
    const [feed] = await getDb()
      .select({ id: feeds.id, lastSyncedAt: feeds.last_synced_at })
      .from(feeds)
      .where(eq(feeds.user_id, FOREIGN_USER))
      .limit(1);
    if (!feed) throw new Error("Seed data missing: foreign user has no feeds");
    return feed;
  }

  it("getFeeds returns only the caller's subscriptions", async () => {
    const mine = await getFeeds(getDb(), AGENT_USER);
    expect(mine.success).toBe(true);
    if (!mine.success) return;
    for (const feed of mine.data) {
      expect(feed.user_id).toBe(AGENT_USER);
    }

    const theirs = await getFeeds(getDb(), FOREIGN_USER);
    expect(theirs.success).toBe(true);
    if (!theirs.success) return;
    const foreignIds = theirs.data.map((f) => f.id);
    expect(mine.data.map((f) => f.id)).not.toEqual(
      expect.arrayContaining(foreignIds),
    );
  });

  it("refreshFeed cannot sync another user's feed and touches no state", async () => {
    const foreignFeed = await getForeignFeed();

    const result = await refreshFeed(getDb(), AGENT_USER, foreignFeed.id);
    expect(result).toEqual({ success: false, error: "Feed not found" });

    const [after] = await getDb()
      .select({ lastSyncedAt: feeds.last_synced_at })
      .from(feeds)
      .where(eq(feeds.id, foreignFeed.id));
    expect(after?.lastSyncedAt ?? null).toBe(foreignFeed.lastSyncedAt ?? null);
  });

  it("deleteFeed cannot delete another user's subscription", async () => {
    const foreignFeed = await getForeignFeed();

    // Silent no-op on foreign ids, matching legacy delete scoping.
    const result = await deleteFeed(getDb(), AGENT_USER, foreignFeed.id);
    expect(result.success).toBe(true);

    const [row] = await getDb()
      .select({ id: feeds.id })
      .from(feeds)
      .where(eq(feeds.id, foreignFeed.id));
    expect(row?.id).toBe(foreignFeed.id);
  });
});
