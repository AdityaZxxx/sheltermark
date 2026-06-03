#!/usr/bin/env tsx
import { createClient } from "@supabase/supabase-js";
import { fetchMetadata } from "~/lib/metadata";
import { parseFeed } from "~/lib/rss-parser";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function syncFeeds(): Promise<{
  success: boolean;
  synced: number;
  errors: string[];
}> {
  let synced = 0;
  const errors: string[] = [];

  // Get all distinct user IDs that have feeds
  const { data: users, error: usersError } = await supabase
    .from("feeds")
    .select("user_id")
    .not("user_id", "is", null);

  if (usersError) {
    console.error("Error fetching users:", usersError);
    return { success: false, synced: 0, errors: [usersError.message] };
  }

  const userIds = [...new Set(users.map((u) => u.user_id))];

  console.log(`Found ${userIds.length} users with feeds to sync`);

  for (const userId of userIds) {
    const result = await syncFeedsForUser(userId);
    synced += result.synced;
    errors.push(...result.errors);
  }

  console.log("Feed sync completed");
  return { success: true, synced, errors };
}

async function syncFeedsForUser(
  userId: string,
): Promise<{ synced: number; errors: string[] }> {
  let synced = 0;
  const errors: string[] = [];

  // Get all feeds for this user
  const { data: feeds, error: feedsError } = await supabase
    .from("feeds")
    .select("*")
    .eq("user_id", userId);

  if (feedsError) {
    console.error(`Error fetching feeds for user:`, feedsError);
    return { synced: 0, errors: [feedsError.message] };
  }

  if (!feeds || feeds.length === 0) {
    console.log("No feeds found for this user");
    return { synced: 0, errors: [] };
  }

  console.log(`Syncing ${feeds.length} feeds...`);

  for (const feed of feeds) {
    try {
      const parsed = await parseFeed(feed.url);

      const siteMeta = parsed.link
        ? await fetchMetadata(parsed.link).catch(() => null)
        : null;

      // Update feed info
      await supabase
        .from("feeds")
        .update({
          title: parsed.title,
          description: parsed.description,
          site_url: parsed.link,
          icon_url: siteMeta?.favicon_url || null,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", feed.id);

      // Get existing entry guids to avoid duplicates
      const { data: existingEntries } = await supabase
        .from("feed_entries")
        .select("guid")
        .eq("feed_id", feed.id);

      const existingGuids = new Set(existingEntries?.map((e) => e.guid) || []);

      // Insert new entries
      const newEntries = parsed.items
        .filter((item) => !existingGuids.has(item.guid))
        .map((item) => ({
          feed_id: feed.id,
          title: item.title,
          link: item.link,
          content: item.content,
          summary: item.contentSnippet,
          guid: item.guid,
          published: item.pubDate ? new Date(item.pubDate).toISOString() : null,
        }));

      if (newEntries.length > 0) {
        await supabase.from("feed_entries").insert(newEntries);

        // Also create bookmarks for new entries (in the feed's workspace or user's default)
        const workspaceId = feed.workspace_id;

        // If no workspace set, get user's default workspace
        let targetWorkspaceId = workspaceId;
        if (!targetWorkspaceId) {
          const { data: wsData } = await supabase
            .from("workspaces")
            .select("id")
            .eq("user_id", userId)
            .eq("is_default", true)
            .single();
          targetWorkspaceId = wsData?.id;
        }

        if (targetWorkspaceId) {
          const metadataResults = await Promise.all(
            newEntries.map((item) =>
              fetchMetadata(item.link).catch(() => null),
            ),
          );

          const bookmarksToInsert = newEntries.map((item, index) => {
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
            await supabase.from("bookmarks").insert(bookmarksToInsert);
          }
        }
      }

      synced++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error("Error syncing feed:", errorMsg);
      errors.push(errorMsg);
      // Update feed with error?
      await supabase
        .from("feeds")
        .update({
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", feed.id);
    }
  }

  return { synced, errors };
}

// Run if executed directly
if (require.main === module) {
  syncFeeds().then((result) => {
    console.log("Sync result:", result);
    process.exit(result.success ? 0 : 1);
  });
}
