"use server";

import type { ActionResult } from "~/lib/action-result";
import type { Feed } from "~/lib/schemas/feed.schema";

import { requireAuth } from "~/lib/auth";
import { getDb } from "~/lib/data/db";
import {
  deleteFeed as deleteFeedRepo,
  getFeeds as getFeedsRepo,
  refreshFeed as refreshFeedRepo,
  subscribeToFeed as subscribeToFeedRepo,
  syncAllFeeds as syncAllFeedsRepo,
} from "~/lib/data/repositories/feed.repository";

export async function getFeeds(): Promise<ActionResult<Feed[]>> {
  const { user } = await requireAuth();
  return getFeedsRepo(getDb(), user.id);
}

export async function subscribeToFeed(
  url: string,
  workspaceId?: string,
): Promise<ActionResult<Feed>> {
  const { user } = await requireAuth();
  return subscribeToFeedRepo(getDb(), user.id, url, workspaceId);
}

export async function refreshFeed(id: string): Promise<ActionResult<Feed>> {
  const { user } = await requireAuth();
  return refreshFeedRepo(getDb(), user.id, id);
}

export async function deleteFeed(id: string): Promise<ActionResult<null>> {
  const { user } = await requireAuth();
  return deleteFeedRepo(getDb(), user.id, id);
}

export async function syncAllFeeds(): Promise<
  ActionResult<{ synced: number; errors: string[] }>
> {
  const { user } = await requireAuth();
  return syncAllFeedsRepo(getDb(), user.id);
}
