"use server";

import type { ActionResult } from "~/lib/action-result";
import { requireAuth } from "~/lib/auth";
import { fetchMetadata } from "~/lib/metadata";
import { type ParsedFeed, parseFeed } from "~/lib/rss-parser";
import type { Feed } from "~/lib/schemas/feed";
import {
  feedCreateSchema,
  feedDeleteSchema,
  feedRefreshSchema,
} from "~/lib/schemas/feed";

// Use shared ActionResult type

export async function getFeeds(): Promise<ActionResult<Feed[]>> {
  const { user, supabase } = await requireAuth();

  const { data, error } = await supabase
    .from("feeds")
    .select("*")
    .order("created_at", { ascending: false })
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  return { success: true, data: data ?? [] };
}

export async function subscribeToFeed(
  url: string,
  workspaceId?: string,
): Promise<ActionResult<Feed>> {
  const { user, supabase } = await requireAuth();

  const validated = feedCreateSchema.safeParse({ url, workspaceId });

  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message };
  }

  const parsedUrl = validated.data.url;
  const targetWorkspaceId = validated.data.workspaceId || null;

  const existing = await supabase
    .from("feeds")
    .select("id")
    .eq("url", parsedUrl)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing.data) {
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
    ? await fetchMetadata(feedData.link).catch(() => null)
    : null;

  const { data: feed, error: feedError } = await supabase
    .from("feeds")
    .insert([
      {
        url: parsedUrl,
        user_id: user.id,
        workspace_id: targetWorkspaceId,
        title: feedData.title,
        description: feedData.description,
        site_url: feedData.link,
        icon_url: siteMeta?.favicon_url || null,
        last_synced_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (feedError) {
    return { success: false, error: feedError.message };
  }

  const workspaceIdToUse =
    targetWorkspaceId ||
    (await supabase
      .from("workspaces")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .single()
      .then((r) => r.data?.id));

  const itemsToInsert = feedData.items.slice(0, 50);

  const metadataResults = await Promise.all(
    itemsToInsert.map((item) => fetchMetadata(item.link).catch(() => null)),
  );

  const bookmarksToInsert = itemsToInsert.map((item, index) => {
    const meta = metadataResults[index];
    return {
      user_id: user.id,
      workspace_id: workspaceIdToUse,
      url: item.link,
      title: item.title,
      favicon_url: meta?.favicon_url || null,
      og_image_url: meta?.og_image_url || null,
    };
  });

  if (bookmarksToInsert.length > 0) {
    await supabase.from("bookmarks").insert(bookmarksToInsert);
  }

  return { success: true, data: feed };
}

export async function refreshFeed(id: string): Promise<ActionResult<Feed>> {
  const { user, supabase } = await requireAuth();

  const validated = feedRefreshSchema.safeParse({ id });
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message };
  }

  const { data: feed } = await supabase
    .from("feeds")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!feed) {
    return { success: false, error: "Feed not found" };
  }

  let feedData: ParsedFeed | undefined;
  try {
    feedData = await parseFeed(feed.url);
  } catch (err) {
    await supabase
      .from("feeds")
      .update({
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", id);

    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to parse feed",
    };
  }

  const existingGuids = await supabase
    .from("feed_entries")
    .select("guid")
    .eq("feed_id", id)
    .then((r) => new Set(r.data?.map((e) => e.guid) || []));

  const newItems = feedData.items
    .filter((item) => !existingGuids.has(item.guid))
    .slice(0, 20);

  if (newItems.length > 0) {
    const entriesToInsert = newItems.map((item) => ({
      feed_id: id,
      title: item.title,
      link: item.link,
      content: item.content,
      summary: item.contentSnippet,
      guid: item.guid,
      published: item.pubDate ? new Date(item.pubDate).toISOString() : null,
    }));

    await supabase.from("feed_entries").insert(entriesToInsert);

    const metadataResults = await Promise.all(
      newItems.map((item) => fetchMetadata(item.link).catch(() => null)),
    );

    const bookmarksToInsert = newItems.map((item, index) => {
      const meta = metadataResults[index];
      return {
        user_id: user.id,
        workspace_id: feed.workspace_id,
        url: item.link,
        title: item.title,
        favicon_url: meta?.favicon_url || null,
        og_image_url: meta?.og_image_url || null,
      };
    });

    if (bookmarksToInsert.length > 0 && feed.workspace_id) {
      await supabase.from("bookmarks").insert(bookmarksToInsert);
    }
  }

  const siteMeta = feedData.link
    ? await fetchMetadata(feedData.link).catch(() => null)
    : null;

  const { error: updateError } = await supabase
    .from("feeds")
    .update({
      title: feedData.title,
      description: feedData.description,
      site_url: feedData.link,
      icon_url: siteMeta?.favicon_url || null,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true, data: { ...feed, title: feedData.title } };
}

export async function deleteFeed(id: string): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();

  const validated = feedDeleteSchema.safeParse({ id });
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message };
  }

  const { error } = await supabase
    .from("feeds")
    .delete()
    .eq("id", validated.data.id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  return { success: true, data: null };
}

export async function syncAllFeeds(): Promise<
  ActionResult<{ synced: number; errors: string[] }>
> {
  const { user, supabase } = await requireAuth();

  const { data: feeds } = await supabase
    .from("feeds")
    .select("*")
    .eq("user_id", user.id);

  if (!feeds || feeds.length === 0) {
    return { success: true, data: { synced: 0, errors: [] } };
  }

  let synced = 0;
  const errors: string[] = [];

  for (const feed of feeds) {
    const result = await refreshFeed(feed.id);
    if (result.success) {
      synced++;
    } else {
      errors.push(`${feed.title || feed.url}: ${result.error}`);
    }
  }

  return { success: true, data: { synced, errors } };
}
