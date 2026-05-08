import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  deleteFeed,
  refreshFeed,
  subscribeToFeed,
  syncAllFeeds,
} from "~/app/action/feed.action";
import type { ActionResult } from "~/lib/action-result";
import { logger } from "~/lib/logger";
import { createOptimisticMutation } from "~/lib/mutations/base";
import { feedKeys } from "~/lib/query-keys";
import type { Feed } from "~/lib/schemas/feed.schema";

const generateTempId = () =>
  `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function useSubscribeToFeed(userId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = feedKeys.byUser(userId);

  return useMutation({
    mutationFn: ({ url, workspaceId }: { url: string; workspaceId?: string }) =>
      subscribeToFeed(url, workspaceId),
    onMutate: async ({ url }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousFeeds = queryClient.getQueryData(queryKey);

      const tempId = generateTempId();
      const optimisticFeed = {
        id: tempId,
        url,
        user_id: userId || "",
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
    onError: (error, variables, context) => {
      logger.error("subscribeToFeed failed", { error, variables: variables });
      if (context?.previousFeeds) {
        queryClient.setQueryData(queryKey, context.previousFeeds);
      }
      toast.error("Failed to subscribe to feed");
    },
    onSuccess: (result: ActionResult<unknown>) => {
      if (result.success) {
        toast.success("Subscribed to feed");
      } else {
        toast.error(result.error);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useRefreshFeed(userId: string | undefined) {
  return createOptimisticMutation<string, Feed>({
    mutationFn: refreshFeed,
    queryKey: feedKeys.byUser(userId),
    errorMessage: "Failed to refresh feed",
    prepareOptimisticData: (oldData, id) => {
      const prev = oldData as Feed[];
      return prev.map((feed) =>
        feed.id === id
          ? { ...feed, last_synced_at: new Date().toISOString() }
          : feed,
      );
    },
  });
}

export function useDeleteFeed(userId: string | undefined) {
  return createOptimisticMutation<string, null>({
    mutationFn: deleteFeed,
    queryKey: feedKeys.byUser(userId),
    successMessage: "Feed deleted",
    errorMessage: "Failed to delete feed",
    prepareOptimisticData: (oldData, id) => {
      const prev = oldData as Feed[];
      return prev.filter((feed) => feed.id !== id);
    },
  });
}

export function useSyncAllFeeds(userId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = feedKeys.byUser(userId);

  return useMutation({
    mutationFn: syncAllFeeds,
    onSuccess: (result: ActionResult<{ synced: number; errors: string[] }>) => {
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
      logger.error("syncAllFeeds failed", { error });
      toast.error("Failed to sync feeds");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
