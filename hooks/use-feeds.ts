"use client";

import { useQuery } from "@tanstack/react-query";

import { useUser } from "~/components/providers/user-context";
import {
  useDeleteFeed,
  useRefreshFeed,
  useSubscribeToFeed,
  useSyncAllFeeds,
} from "~/lib/mutations/feed.mutations";
import { feedsQueryOptions } from "~/lib/queries/feed.queries";

export function useFeeds() {
  const userId = useUser().id;

  const { data: feeds = [], isLoading: isFeedsLoading } = useQuery(
    feedsQueryOptions(userId),
  );

  const subscribeMutation = useSubscribeToFeed(userId);
  const refreshMutation = useRefreshFeed(userId);
  const deleteMutation = useDeleteFeed(userId);
  const syncAllMutation = useSyncAllFeeds(userId);

  return {
    feeds,
    isLoading: isFeedsLoading,
    subscribeToFeed: subscribeMutation.mutate,
    isSubscribing: subscribeMutation.isPending,
    refreshFeed: refreshMutation.mutate,
    isRefreshing: refreshMutation.isPending,
    deleteFeed: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    syncAllFeeds: syncAllMutation.mutate,
    isSyncing: syncAllMutation.isPending,
  };
}
