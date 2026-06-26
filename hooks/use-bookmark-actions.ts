"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import type { Bookmark } from "~/lib/schemas/bookmark.schema";
import type {
  Workspace,
  WorkspaceWithCount,
} from "~/lib/schemas/workspace.schema";

interface UseBookmarkActionsProps {
  selectedIds: string[];
  filteredBookmarks: Bookmark[];
  currentWorkspace: Workspace | WorkspaceWithCount | null | undefined;
  workspaces: (Workspace | WorkspaceWithCount)[];
  addBookmark: (
    data: { url: string; workspaceId: string },
    options?: { onSuccess?: () => void; onError?: (err: Error) => void },
  ) => void;
  moveBookmarks: (
    data: { ids: string[]; targetWorkspaceId: string },
    options?: {
      onSuccess?: (res: {
        success: boolean;
        data?: { movedCount: number; skippedCount: number };
      }) => void;
    },
  ) => void;
  refetchBookmarkMetadata: (data: { id: string }) => void;
  invalidate: () => void;
  setSearchQuery: (query: string) => void;
  setPendingUrls: React.Dispatch<
    React.SetStateAction<{ id: string; url: string }[]>
  >;
}

export function useBookmarkActions({
  selectedIds,
  filteredBookmarks,
  currentWorkspace,
  workspaces,
  addBookmark,
  moveBookmarks,
  refetchBookmarkMetadata,
  invalidate,
  setSearchQuery,
  setPendingUrls,
}: UseBookmarkActionsProps) {
  const handleCopyUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard");
  }, []);

  const handleBulkCopyUrls = useCallback(() => {
    const urls = filteredBookmarks
      .reduce<string[]>((acc, b) => {
        if (selectedIds.includes(b.id)) acc.push(b.url);
        return acc;
      }, [])
      .join("\n");
    navigator.clipboard.writeText(urls);
    toast.success(`${selectedIds.length} URLs copied`);
  }, [selectedIds, filteredBookmarks]);

  const handleRefetchTrigger = useCallback(
    (id: string) => {
      refetchBookmarkMetadata({ id });
    },
    [refetchBookmarkMetadata],
  );

  const handleMoveToWorkspace = useCallback(
    (id: string, workspaceId: string) => {
      moveBookmarks(
        { ids: [id], targetWorkspaceId: workspaceId },
        {
          onSuccess: (res) => {
            if (res.success && res.data) {
              const workspace = workspaces.find((ws) => ws.id === workspaceId);
              const workspaceName = workspace?.name || "Target Workspace";
              const { movedCount, skippedCount } = res.data;

              if (movedCount > 0 && skippedCount > 0) {
                toast.success(
                  `${movedCount} moved, ${skippedCount} already in ${workspaceName}`,
                );
              } else if (movedCount > 0) {
                toast.success(`Bookmark moved to ${workspaceName}`);
              } else if (skippedCount > 0) {
                toast.info(`Bookmark already exists in ${workspaceName}`);
              }
            }
          },
        },
      );
    },
    [moveBookmarks, workspaces],
  );

  const handleSubmit = useCallback(
    async (val: string) => {
      const trimmed = val.trim();
      const targetWorkspace =
        currentWorkspace ??
        workspaces.find((ws) => ws.is_default) ??
        workspaces[0];
      if (!targetWorkspace) {
        toast.error("Please create a workspace first");
        return;
      }
      if (trimmed.includes(".") || trimmed.startsWith("http")) {
        const normalizedUrl = trimmed.startsWith("http")
          ? trimmed
          : `https://${trimmed}`;

        const pendingId = `pending-${Date.now()}`;
        setPendingUrls((prev) => [
          ...prev,
          { id: pendingId, url: normalizedUrl },
        ]);
        setSearchQuery("");
        addBookmark(
          { url: normalizedUrl, workspaceId: targetWorkspace.id },
          {
            onSuccess: () => {
              setPendingUrls((prev) => prev.filter((p) => p.id !== pendingId));
              invalidate();
            },
            onError: (err) => {
              setPendingUrls((prev) => prev.filter((p) => p.id !== pendingId));
              toast.error(err.message || "Failed to add bookmark");
            },
          },
        );
      }
    },
    [
      currentWorkspace,
      workspaces,
      addBookmark,
      invalidate,
      setSearchQuery,
      setPendingUrls,
    ],
  );

  return {
    handleCopyUrl,
    handleBulkCopyUrls,
    handleRefetchTrigger,
    handleMoveToWorkspace,
    handleSubmit,
  };
}
