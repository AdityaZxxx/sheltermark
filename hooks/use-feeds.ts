"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  deleteFeed,
  getFeeds,
  refreshFeed,
  subscribeToFeed,
  syncAllFeeds,
} from "~/app/action/feed";
import { useSupabase } from "~/components/providers/supabase-provider";
import { feedKeys } from "~/lib/query-keys";
import type { Feed } from "~/lib/schemas/feed";

const generateTempId = () =>
  `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const feedsQueryOptions = (userId: string | undefined) => ({
  queryKey: feedKeys.byUser(userId),
  queryFn: async (): Promise<Feed[]> => {
    const result = await getFeeds();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  enabled: !!userId,
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 30,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
});

export function useFeeds() {
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useSupabase();

  const queryKey = useMemo(() => feedKeys.byUser(user?.id), [user?.id]);

  const { data: feeds = [], isLoading: isFeedsLoading } = useQuery(
    feedsQueryOptions(user?.id),
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const subscribeMutation = useMutation({
    mutationFn: ({ url, workspaceId }: { url: string; workspaceId?: string }) =>
      subscribeToFeed(url, workspaceId),
    onMutate: async ({ url }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousFeeds = queryClient.getQueryData(queryKey);

      const tempId = generateTempId();
      const optimisticFeed = {
        id: tempId,
        url,
        user_id: user?.id || "",
        workspace_id: null,
        title: "Loading...",
        description: null,
        site_url: null,
        icon_url: null,
        last_synced_at: null,
        created_at: new Date().toISOString(),
        updated_at: null,
      } satisfies Feed;

      queryClient.setQueryData(queryKey, (old: Feed[] = []) => [
        ...old,
        optimisticFeed,
      ]);

      return { previousFeeds };
    },
    onError: (error, _variables, context) => {
      console.error("[useFeeds] subscribeToFeed failed:", error);
      if (context?.previousFeeds) {
        queryClient.setQueryData(queryKey, context.previousFeeds);
      }
      toast.error("Failed to subscribe to feed");
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Subscribed to feed");
      } else {
        toast.error(result.error);
      }
    },
    onSettled: () => {
      invalidate();
    },
  });

  const refreshMutation = useMutation({
    mutationFn: refreshFeed,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previousFeeds = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: Feed[] = []) =>
        old.map((feed) =>
          feed.id === id
            ? { ...feed, last_synced_at: new Date().toISOString() }
            : feed,
        ),
      );

      return { previousFeeds };
    },
    onError: (error, _variables, context) => {
      console.error("[useFeeds] refreshFeed failed:", error);
      if (context?.previousFeeds) {
        queryClient.setQueryData(queryKey, context.previousFeeds);
      }
      toast.error("Failed to refresh feed");
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error);
      }
    },
    onSettled: () => {
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFeed,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previousFeeds = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: Feed[] = []) =>
        old.filter((feed) => feed.id !== id),
      );

      return { previousFeeds };
    },
    onError: (error, _variables, context) => {
      console.error("[useFeeds] deleteFeed failed:", error);
      if (context?.previousFeeds) {
        queryClient.setQueryData(queryKey, context.previousFeeds);
      }
      toast.error("Failed to delete feed");
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Feed deleted");
      } else {
        toast.error(result.error);
      }
    },
    onSettled: () => {
      invalidate();
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: syncAllFeeds,
    onSuccess: (result) => {
      if (result.success) {
        const d = result.data;
        toast.success(`Synced ${d?.synced ?? 0} feeds`);
        if (d?.errors?.length) {
          for (const err of d.errors) {
            toast.error(err);
          }
        }
      } else {
        toast.error(result.error);
      }
    },
    onError: (error) => {
      console.error("[useFeeds] syncAllFeeds failed:", error);
      toast.error("Failed to sync feeds");
    },
    onSettled: () => {
      invalidate();
    },
  });

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
