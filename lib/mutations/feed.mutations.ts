import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ActionResult } from "~/lib/action-result";
import type { Feed } from "~/lib/schemas/feed.schema";

import {
  deleteFeed,
  refreshFeed,
  subscribeToFeed,
  syncAllFeeds,
} from "~/app/action/feed.action";
import { logger } from "~/lib/logger";
import {
  optimisticAppend,
  optimisticRemove,
  optimisticUpdate,
  useOptimisticMutation,
} from "~/lib/mutations/base";
import { feedKeys } from "~/lib/query-keys";

const generateTempId = () =>
  `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function useSubscribeToFeed(userId: string | undefined) {
  return useOptimisticMutation<
    { url: string; workspaceId?: string },
    Feed,
    Feed[]
  >({
    mutationFn: ({ url, workspaceId }) => subscribeToFeed(url, workspaceId),
    mutationKey: ["subscribeToFeed"],
    queryKey: feedKeys.byUser(userId),
    successMessage: "Subscribed to feed",
    errorMessage: "Failed to subscribe to feed",
    prepareOptimisticData: (oldData, { url }) => {
      return optimisticAppend(oldData, {
        id: generateTempId(),
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
      });
    },
  });
}

export function useRefreshFeed(userId: string | undefined) {
  return useOptimisticMutation<string, Feed, Feed[]>({
    mutationFn: refreshFeed,
    queryKey: feedKeys.byUser(userId),
    errorMessage: "Failed to refresh feed",
    prepareOptimisticData: (oldData, id) => {
      return optimisticUpdate(oldData, id, (feed) => ({
        ...feed,
        last_synced_at: new Date().toISOString(),
      }));
    },
  });
}

export function useDeleteFeed(userId: string | undefined) {
  return useOptimisticMutation<string, null, Feed[]>({
    mutationFn: deleteFeed,
    queryKey: feedKeys.byUser(userId),
    successMessage: "Feed deleted",
    errorMessage: "Failed to delete feed",
    prepareOptimisticData: (oldData, id) => {
      return optimisticRemove(oldData, id);
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
