"use client";

import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "~/components/providers/supabase-provider";
import {
  useDeleteFeed,
  useRefreshFeed,
  useSubscribeToFeed,
  useSyncAllFeeds,
} from "~/lib/mutations/feed.mutations";
import { feedsQueryOptions } from "~/lib/queries/feed.queries";

export function useFeeds() {
  const { user, isLoading: isAuthLoading } = useSupabase();

  const { data: feeds = [], isLoading: isFeedsLoading } = useQuery(
    feedsQueryOptions(user?.id),
  );

  const subscribeMutation = useSubscribeToFeed(user?.id);
  const refreshMutation = useRefreshFeed(user?.id);
  const deleteMutation = useDeleteFeed(user?.id);
  const syncAllMutation = useSyncAllFeeds(user?.id);

  return {
    feeds,
    isLoading: isAuthLoading || isFeedsLoading,
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
