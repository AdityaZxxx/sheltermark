import { and, desc, eq } from "drizzle-orm";

import type { ActionResult } from "~/lib/action-result";
import type { DrizzleDb } from "~/lib/data/db";
import type { Feed } from "~/lib/schemas/feed.schema";

import { bookmarks, feedEntries, feeds, workspaces } from "~/lib/data/schema";
import { type ParsedFeed, parseFeed } from "~/lib/feeds/rss-parser";
import { fetchMetadata } from "~/lib/metadata/pipeline";
import {
  feedCreateSchema,
  feedDeleteSchema,
  feedRefreshSchema,
} from "~/lib/schemas/feed.schema";
import { logger } from "~/lib/utils/logger";

type FeedRow = typeof feeds.$inferSelect;

function toFeed(row: FeedRow): Feed {
  return {
    id: row.id,
    user_id: row.userId,
    workspace_id: row.workspaceId,
    url: row.url,
    title: row.title,
    description: row.description,
    site_url: row.siteUrl,
    icon_url: row.iconUrl,
    last_synced_at: row.lastSyncedAt?.toISOString() ?? null,
    created_at: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

function dbError(cause: unknown): ActionResult<never> {
  return {
    success: false,
    error: cause instanceof Error ? cause.message : "Database error",
  };
}

/**
 * SECURITY: Drizzle connects with the service-role credential and BYPASSES
 * ROW LEVEL SECURITY. Own-feed queries key on `user_id` explicitly; the
 * cron path (syncAllFeedsGlobal) reads every user by design. Bookmark and
 * feed-entry inserts swallow constraint errors to match the pre-migration
 * behaviour, where feed syncs tolerated partial duplicate inserts.
 */
export async function getFeeds(
  db: DrizzleDb,
  userId: string,
): Promise<ActionResult<Feed[]>> {
  try {
    const rows = await db
      .select()
      .from(feeds)
      .where(eq(feeds.userId, userId))
      .orderBy(desc(feeds.createdAt));
    return { success: true, data: rows.map(toFeed) };
  } catch (cause) {
    return dbError(cause);
  }
}

export async function subscribeToFeed(
  db: DrizzleDb,
  userId: string,
  url: string,
  workspaceId?: string,
): Promise<ActionResult<Feed>> {
  const validated = feedCreateSchema.safeParse({ url, workspaceId });
  if (!validated.success) {
    const msg = validated.error?.issues?.[0]?.message ?? "Invalid feed data";
    return { success: false, error: msg };
  }

  const parsedUrl = validated.data.url;
  const targetWorkspaceId = validated.data.workspaceId || null;

  let existing: { id: string }[];
  try {
    existing = await db
      .select({ id: feeds.id })
      .from(feeds)
      .where(and(eq(feeds.url, parsedUrl), eq(feeds.userId, userId)))
      .limit(1);
  } catch (cause) {
    return dbError(cause);
  }

  if (existing.length > 0) {
    return { success: false, error: "You are already subscribed to this feed" };
  }

  let feedData: ParsedFeed | undefined;
  try {
    feedData = await parseFeed(parsedUrl);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to parse feed",
    };
  }

  const siteMeta = feedData.link
    ? await fetchMetadata(feedData.link).catch((fetchErr) => {
        logger.warn("Failed to fetch metadata for feed site", {
          url: feedData.link,
          error: fetchErr,
        });
        return null;
      })
    : null;

  let feedRow: FeedRow;
  try {
    const inserted = await db
      .insert(feeds)
      .values({
        url: parsedUrl,
        userId,
        workspaceId: targetWorkspaceId,
        title: feedData.title,
        description: feedData.description,
        siteUrl: feedData.link,
        iconUrl: siteMeta?.favicon_url || null,
        lastSyncedAt: new Date(),
      })
      .returning();
    const first = inserted[0];
    if (!first) return { success: false, error: "Insert returned no row" };
    feedRow = first;
  } catch (cause) {
    return dbError(cause);
  }

  const [defaultWorkspace] = targetWorkspaceId
    ? []
    : await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(
          and(eq(workspaces.userId, userId), eq(workspaces.isDefault, true)),
        )
        .limit(1);

  const workspaceIdToUse = targetWorkspaceId || defaultWorkspace?.id || null;

  const itemsToInsert = feedData.items.slice(0, 50);
  const metadataResults = await Promise.all(
    itemsToInsert.map((item) =>
      fetchMetadata(item.link).catch((fetchErr) => {
        logger.warn("Failed to fetch metadata for feed item", {
          url: item.link,
          error: fetchErr,
        });
        return null;
      }),
    ),
  );

  const bookmarksToInsert = itemsToInsert.map((item, index) => {
    const meta = metadataResults[index];
    return {
      user_id: userId,
      workspace_id: workspaceIdToUse,
      url: item.link,
      title: item.title,
      favicon_url: meta?.favicon_url || null,
      og_image_url: meta?.og_image_url || null,
    };
  });

  if (bookmarksToInsert.length > 0) {
    try {
      await db.insert(bookmarks).values(bookmarksToInsert);
    } catch (err) {
      logger.warn("Feed subscribe skipped some bookmarks", { error: err });
    }
  }

  return { success: true, data: toFeed(feedRow) };
}

type SyncFeedOptions = {
  maxItems?: number;
};

async function syncSingleFeed(
  db: DrizzleDb,
  feed: Feed,
  userId: string,
  options?: SyncFeedOptions,
): Promise<ActionResult<{ syncedCount: number }>> {
  let feedData: ParsedFeed;
  try {
    feedData = await parseFeed(feed.url);
  } catch (err) {
    await db
      .update(feeds)
      .set({ lastSyncedAt: new Date() })
      .where(eq(feeds.id, feed.id));
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to parse feed",
    };
  }

  const existingGuidRows = await db
    .select({ guid: feedEntries.guid })
    .from(feedEntries)
    .where(eq(feedEntries.feedId, feed.id));
  const existingGuids = new Set(existingGuidRows.map((e) => e.guid));

  let newItems = feedData.items.filter((item) => !existingGuids.has(item.guid));
  if (options?.maxItems !== undefined) {
    newItems = newItems.slice(0, options.maxItems);
  }

  if (newItems.length > 0) {
    const entriesToInsert = newItems.map((item) => ({
      feedId: feed.id,
      title: item.title,
      link: item.link,
      content: item.content ?? null,
      summary: item.contentSnippet ?? null,
      guid: item.guid,
      published: item.pubDate ? new Date(item.pubDate) : null,
    }));
    await db.insert(feedEntries).values(entriesToInsert);

    let targetWorkspaceId = feed.workspace_id;
    if (!targetWorkspaceId) {
      const [defaultWorkspace] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(
          and(eq(workspaces.userId, userId), eq(workspaces.isDefault, true)),
        )
        .limit(1);
      targetWorkspaceId = defaultWorkspace?.id ?? null;
    }

    if (targetWorkspaceId) {
      const metadataResults = await Promise.all(
        newItems.map((item) => fetchMetadata(item.link).catch(() => null)),
      );

      const bookmarksToInsert = newItems.map((item, index) => {
        const meta = metadataResults[index];
        return {
          user_id: userId,
          workspace_id: targetWorkspaceId,
          url: item.link,
          title: item.title,
          favicon_url: meta?.favicon_url || null,
          og_image_url: meta?.og_image_url || null,
        };
      });

      if (bookmarksToInsert.length > 0) {
        try {
          await db.insert(bookmarks).values(bookmarksToInsert);
        } catch (err) {
          logger.warn("Feed sync skipped some bookmarks", { error: err });
        }
      }
    }
  }

  const siteMeta = feedData.link
    ? await fetchMetadata(feedData.link).catch(() => null)
    : null;

  await db
    .update(feeds)
    .set({
      title: feedData.title,
      description: feedData.description,
      siteUrl: feedData.link,
      iconUrl: siteMeta?.favicon_url || null,
      lastSyncedAt: new Date(),
    })
    .where(eq(feeds.id, feed.id));

  return { success: true, data: { syncedCount: newItems.length } };
}

export async function refreshFeed(
  db: DrizzleDb,
  userId: string,
  id: string,
): Promise<ActionResult<Feed>> {
  const validated = feedRefreshSchema.safeParse({ id });
  if (!validated.success) {
    const msg = validated.error?.issues?.[0]?.message ?? "Invalid feed data";
    return { success: false, error: msg };
  }

  let feedRow: FeedRow | undefined;
  try {
    const rows = await db
      .select()
      .from(feeds)
      .where(and(eq(feeds.id, validated.data.id), eq(feeds.userId, userId)))
      .limit(1);
    feedRow = rows[0];
  } catch (cause) {
    return dbError(cause);
  }

  if (!feedRow) {
    return { success: false, error: "Feed not found" };
  }

  const feed = toFeed(feedRow);
  const result = await syncSingleFeed(db, feed, userId, {
    maxItems: 20,
  });
  if (!result.success) return result;

  return {
    success: true,
    data: { ...feed, last_synced_at: new Date().toISOString() },
  };
}

export async function deleteFeed(
  db: DrizzleDb,
  userId: string,
  id: string,
): Promise<ActionResult<null>> {
  const validated = feedDeleteSchema.safeParse({ id });
  if (!validated.success) {
    const msg = validated.error?.issues?.[0]?.message ?? "Invalid feed id";
    return { success: false, error: msg };
  }

  try {
    await db
      .delete(feeds)
      .where(and(eq(feeds.id, validated.data.id), eq(feeds.userId, userId)));
  } catch (cause) {
    return dbError(cause);
  }
  return { success: true, data: null };
}

export async function syncAllFeeds(
  db: DrizzleDb,
  userId: string,
): Promise<ActionResult<{ synced: number; errors: string[] }>> {
  let feedRows: FeedRow[];
  try {
    feedRows = await db.select().from(feeds).where(eq(feeds.userId, userId));
  } catch (cause) {
    return dbError(cause);
  }

  if (feedRows.length === 0) {
    return { success: true, data: { synced: 0, errors: [] } };
  }

  const feedsToSync = feedRows.map(toFeed);
  const results = await Promise.allSettled(
    feedsToSync.map((feed) => refreshFeed(db, userId, feed.id)),
  );

  let synced = 0;
  const errors: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const feed = feedsToSync[i];
    const result = results[i];
    if (!result || !feed) continue;
    if (result.status === "fulfilled") {
      if (result.value.success) {
        synced++;
      } else {
        errors.push(`${feed.title || feed.url}: ${result.value.error}`);
      }
    } else {
      errors.push(
        `${feed.title || feed.url}: ${result.reason?.message ?? "Sync failed"}`,
      );
    }
  }

  return { success: true, data: { synced, errors } };
}

export async function syncAllFeedsGlobal(
  db: DrizzleDb,
): Promise<ActionResult<{ synced: number; errors: string[] }>> {
  let userRows: { userId: string }[];
  try {
    userRows = await db.selectDistinct({ userId: feeds.userId }).from(feeds);
  } catch (cause) {
    return dbError(cause);
  }

  let totalSynced = 0;
  const allErrors: string[] = [];

  for (const { userId } of userRows) {
    const result = await syncAllFeeds(db, userId);
    if (result.success) {
      totalSynced += result.data.synced;
      allErrors.push(...result.data.errors);
    } else {
      allErrors.push(`User ${userId}: ${result.error}`);
    }
  }

  return { success: true, data: { synced: totalSynced, errors: allErrors } };
}
