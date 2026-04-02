"use client";

import { BookmarkIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useBookmarkSelection } from "~/hooks/use-bookmark-selection";
import { useBookmarks } from "~/hooks/use-bookmarks";
import { useWorkspaces } from "~/hooks/use-workspaces";
import { normalizeUrl, safeDomain } from "~/lib/utils";
import type { Bookmark } from "~/types/bookmark.types";
import { BookmarkCardItem } from "./bookmark-card-item";
import { BookmarkCardItemLoading } from "./bookmark-card-item-loading";
import { BookmarkDeleteDialog } from "./bookmark-delete-dialog";
import { BookmarkInput } from "./bookmark-input";
import { BookmarkListItem } from "./bookmark-list-item";
import { BookmarkListItemLoading } from "./bookmark-list-item-loading";
import { BookmarkMoveDialog } from "./bookmark-move-dialog";
import { BookmarkRenameDialog } from "./bookmark-rename-dialog";
import { BookmarkSkeleton } from "./bookmark-skeleton";
import { BookmarkToolbar } from "./bookmark-toolbar";
import { BookmarkViewToggle } from "./bookmark-view-toggle";

export function BookmarkView() {
  const [view, setView] = useState<"list" | "card">("list");
  const inputRef = useRef<HTMLInputElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [activeBookmark, setActiveBookmark] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [bookmarksToDelete, setBookmarksToDelete] = useState<string[]>([]);
  const [bookmarksToMove, setBookmarksToMove] = useState<string[]>([]);
  const [pendingUrls, setPendingUrls] = useState<{ id: string; url: string }[]>(
    [],
  );

  const { workspaces, currentWorkspace } = useWorkspaces();
  const {
    filteredBookmarks,
    isLoading,
    searchQuery,
    setSearchQuery,
    invalidate,
    moveBookmarks,
    addBookmark,
    refetchBookmarkMetadata,
  } = useBookmarks(currentWorkspace?.id);

  const {
    selectedIds,
    isSelectionMode,
    toggleSelectionMode,
    toggleSelect,
    selectAll,
    clearSelection,
    clearSelectionOnly,
  } = useBookmarkSelection();

  // Remove pending bookmarks once they appear in the real list
  useEffect(() => {
    if (pendingUrls.length === 0) return;
    setPendingUrls((prev) =>
      prev.filter((p) =>
        filteredBookmarks.some(
          (b: Bookmark) => normalizeUrl(b.url) === normalizeUrl(p.url),
        ),
      ),
    );
  }, [filteredBookmarks, pendingUrls.length]);

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

  const handleDeleteTrigger = useCallback((id: string) => {
    setBookmarksToDelete([id]);
    setDeleteDialogOpen(true);
  }, []);

  const handleBulkDeleteTrigger = useCallback(() => {
    setBookmarksToDelete(selectedIds);
    setDeleteDialogOpen(true);
  }, [selectedIds]);

  const handleRenameTrigger = useCallback(
    (id: string) => {
      const bookmark = filteredBookmarks.find((b: Bookmark) => b.id === id);
      if (bookmark) {
        setActiveBookmark({ id: bookmark.id, title: bookmark.title || "" });
        setRenameDialogOpen(true);
      }
    },
    [filteredBookmarks],
  );

  const handleMoveTrigger = useCallback((id: string) => {
    setBookmarksToMove([id]);
    setMoveDialogOpen(true);
  }, []);

  const handleRefetchTrigger = useCallback(
    (id: string) => {
      refetchBookmarkMetadata(id);
    },
    [refetchBookmarkMetadata],
  );

  const handleMoveToWorkspace = useCallback(
    (id: string, workspaceId: string) => {
      moveBookmarks(
        {
          ids: [id],
          targetWorkspaceId: workspaceId,
        },
        {
          onSuccess: (res) => {
            if (res.success) {
              const workspace = workspaces.find((ws) => ws.id === workspaceId);
              const workspaceName = workspace?.name || "Target Workspace";

              if (res.movedCount > 0 && res.skippedCount > 0) {
                toast.success(
                  `${res.movedCount} moved, ${res.skippedCount} already in ${workspaceName}`,
                );
              } else if (res.movedCount > 0) {
                toast.success(`Bookmark moved to ${workspaceName}`);
              } else if (res.skippedCount > 0) {
                toast.info(`Bookmark already exists in ${workspaceName}`);
              }
            }
          },
        },
      );
    },
    [moveBookmarks, workspaces],
  );

  const handleBulkMoveTrigger = useCallback(() => {
    setBookmarksToMove(selectedIds);
    setMoveDialogOpen(true);
  }, [selectedIds]);

  const handleSubmit = async (val: string) => {
    const trimmed = val.trim();
    if (trimmed.includes(".") || trimmed.startsWith("http")) {
      const formData = new FormData();
      const normalizedUrl = trimmed.startsWith("http")
        ? trimmed
        : `https://${trimmed}`;
      formData.append("url", normalizedUrl);
      if (currentWorkspace?.id) {
        formData.append("workspaceId", currentWorkspace.id);
      }

      const pendingId = `pending-${Date.now()}`;
      setPendingUrls((prev) => [
        ...prev,
        { id: pendingId, url: normalizedUrl },
      ]);
      setSearchQuery("");
      addBookmark(formData, {
        onSuccess: () => {
          invalidate();
        },
        onError: (err) => {
          setPendingUrls((prev) => prev.filter((p) => p.id !== pendingId));
          toast.error(err.message || "Failed to add bookmark");
        },
      });
    } else {
      // Search query is already updated via onChange, clear focused index
      setFocusedIndex(-1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      inputRef.current?.focus();
      setFocusedIndex(-1);
      return;
    }

    if (
      document.activeElement === inputRef.current ||
      document.activeElement?.tagName === "INPUT" ||
      document.activeElement?.tagName === "TEXTAREA"
    ) {
      return;
    }

    const itemCount = filteredBookmarks.length;
    if (itemCount === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < itemCount - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (view === "card") {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev < itemCount - 1 ? prev + 1 : prev));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      }
    }

    if (e.key === "Enter" && focusedIndex >= 0) {
      const bookmark = filteredBookmarks[focusedIndex];
      if (bookmark) {
        if (isSelectionMode) {
          toggleSelect(bookmark.id);
        } else {
          window.open(bookmark.url, "_blank");
        }
      }
    }
  };

  return (
    <section
      aria-label="Bookmarks"
      className="max-w-2xl mx-auto py-8 px-4 md:px-6 space-y-6 relative outline-none"
      onKeyDown={handleKeyDown}
    >
      <div className="space-y-4 mx-auto">
        <BookmarkInput
          ref={inputRef}
          value={searchQuery}
          onChange={setSearchQuery}
          onSubmit={handleSubmit}
        />

        <div className="flex items-center justify-between pt-2">
          <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            {searchQuery ? "Search Results" : "All Bookmarks"}
          </h2>
          <BookmarkViewToggle view={view} onViewChange={setView} />
        </div>
      </div>

      {isLoading ? (
        <BookmarkSkeleton count={6} view={view} />
      ) : filteredBookmarks.length === 0 && pendingUrls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12  flex items-center justify-center mb-4">
            <BookmarkIcon className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground mb-1">
            {searchQuery ? "No results found" : "No bookmarks yet"}
          </h3>
        </div>
      ) : (
        <div
          className={
            view === "card"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              : "flex flex-col gap-1"
          }
        >
          {pendingUrls.map((pending) =>
            view === "card" ? (
              <BookmarkCardItemLoading key={pending.id} url={pending.url} />
            ) : (
              <BookmarkListItemLoading key={pending.id} url={pending.url} />
            ),
          )}
          {filteredBookmarks.map((bookmark: Bookmark, index: number) =>
            view === "card" ? (
              <div key={bookmark.id} id={`bookmark-${bookmark.id}`}>
                <BookmarkCardItem
                  id={bookmark.id}
                  title={bookmark.title || ""}
                  url={bookmark.url}
                  og_image_url={bookmark.og_image_url || undefined}
                  favicon_url={bookmark.favicon_url || undefined}
                  domain={bookmark.domain || safeDomain(bookmark.url)}
                  created_at={bookmark.created_at}
                  isBroken={bookmark.is_broken}
                  httpStatus={bookmark.http_status}
                  autoCheckBroken={
                    currentWorkspace?.auto_check_broken !== false
                  }
                  isSelected={
                    selectedIds.includes(bookmark.id) ||
                    (!isSelectionMode && focusedIndex === index)
                  }
                  isSelectionMode={isSelectionMode}
                  workspaces={workspaces}
                  currentWorkspaceId={currentWorkspace?.id}
                  onSelect={toggleSelect}
                  onDelete={handleDeleteTrigger}
                  onRename={handleRenameTrigger}
                  onMove={handleMoveTrigger}
                  onMoveToWorkspace={handleMoveToWorkspace}
                  onCopyUrl={handleCopyUrl}
                  onRefetch={handleRefetchTrigger}
                  onSelectionModeToggle={toggleSelectionMode}
                  tabIndex={
                    focusedIndex === index ||
                    (focusedIndex === -1 && index === 0)
                      ? 0
                      : -1
                  }
                />
              </div>
            ) : (
              <div key={bookmark.id} id={`bookmark-${bookmark.id}`}>
                <BookmarkListItem
                  id={bookmark.id}
                  title={bookmark.title || ""}
                  url={bookmark.url}
                  favicon_url={bookmark.favicon_url || undefined}
                  domain={bookmark.domain || safeDomain(bookmark.url)}
                  created_at={bookmark.created_at}
                  isBroken={bookmark.is_broken}
                  httpStatus={bookmark.http_status}
                  autoCheckBroken={
                    currentWorkspace?.auto_check_broken !== false
                  }
                  isSelected={
                    selectedIds.includes(bookmark.id) ||
                    (!isSelectionMode && focusedIndex === index)
                  }
                  isSelectionMode={isSelectionMode}
                  workspaces={workspaces}
                  currentWorkspaceId={currentWorkspace?.id}
                  onSelect={toggleSelect}
                  onDelete={handleDeleteTrigger}
                  onRename={handleRenameTrigger}
                  onMove={handleMoveTrigger}
                  onMoveToWorkspace={handleMoveToWorkspace}
                  onCopyUrl={handleCopyUrl}
                  onRefetch={handleRefetchTrigger}
                  onSelectionModeToggle={toggleSelectionMode}
                  tabIndex={
                    focusedIndex === index ||
                    (focusedIndex === -1 && index === 0)
                      ? 0
                      : -1
                  }
                />
              </div>
            ),
          )}
        </div>
      )}

      <BookmarkToolbar
        selectedCount={selectedIds.length}
        isSelectionMode={isSelectionMode}
        isAllSelected={
          selectedIds.length === filteredBookmarks.length &&
          filteredBookmarks.length > 0
        }
        onClear={clearSelection}
        onToggleSelectAll={
          selectedIds.length === filteredBookmarks.length &&
          filteredBookmarks.length > 0
            ? clearSelectionOnly
            : () => selectAll(filteredBookmarks.map((b: Bookmark) => b.id))
        }
        onDelete={handleBulkDeleteTrigger}
        onMove={handleBulkMoveTrigger}
        onCopyUrls={handleBulkCopyUrls}
      />

      {/* Dialogs */}
      <BookmarkRenameDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        bookmark={activeBookmark}
        onSuccess={invalidate}
      />

      <BookmarkDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        ids={bookmarksToDelete}
        onSuccess={() => {
          invalidate();
          if (bookmarksToDelete.length > 1) clearSelection();
        }}
      />

      <BookmarkMoveDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        ids={bookmarksToMove}
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspace?.id}
        onSuccess={() => {
          invalidate();
          if (bookmarksToMove.length > 1) clearSelection();
        }}
      />
    </section>
  );
}
