"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import type { Bookmark } from "~/lib/schemas/bookmark";
import type { Workspace } from "~/lib/schemas/workspace";

interface UseBookmarkActionsProps {
  selectedIds: string[];
  filteredBookmarks: Bookmark[];
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
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
      .filter((b: Bookmark) => selectedIds.includes(b.id))
      .map((b: Bookmark) => b.url)
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
      if (!currentWorkspace) {
        toast.error("Please select a workspace first");
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
          { url: normalizedUrl, workspaceId: currentWorkspace.id },
          {
            onSuccess: () => {
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
    [currentWorkspace, addBookmark, invalidate, setSearchQuery, setPendingUrls],
  );

  return {
    handleCopyUrl,
    handleBulkCopyUrls,
    handleRefetchTrigger,
    handleMoveToWorkspace,
    handleSubmit,
  };
}
