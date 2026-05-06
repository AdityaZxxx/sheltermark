"use server";

import type { ActionResult } from "~/lib/action-result";
import { requireAuth } from "~/lib/auth";
import {
  deleteFeed as deleteFeedRepo,
  getFeeds as getFeedsRepo,
  refreshFeed as refreshFeedRepo,
  subscribeToFeed as subscribeToFeedRepo,
  syncAllFeeds as syncAllFeedsRepo,
} from "~/lib/data/repositories/feed.repository";
import type { Feed } from "~/lib/schemas/feed.schema";

export async function getFeeds(): Promise<ActionResult<Feed[]>> {
  const { user, supabase } = await requireAuth();
  return getFeedsRepo(supabase, user.id);
}

export async function subscribeToFeed(
  url: string,
  workspaceId?: string,
): Promise<ActionResult<Feed>> {
  const { user, supabase } = await requireAuth();
  return subscribeToFeedRepo(supabase, user.id, url, workspaceId);
}

export async function refreshFeed(id: string): Promise<ActionResult<Feed>> {
  const { user, supabase } = await requireAuth();
  return refreshFeedRepo(supabase, user.id, id);
}

export async function deleteFeed(id: string): Promise<ActionResult<null>> {
  const { user, supabase } = await requireAuth();
  return deleteFeedRepo(supabase, user.id, id);
}

export async function syncAllFeeds(): Promise<
  ActionResult<{ synced: number; errors: string[] }>
> {
  const { user, supabase } = await requireAuth();
  return syncAllFeedsRepo(supabase, user.id);
}
