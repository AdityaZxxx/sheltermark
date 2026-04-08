"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useBookmarkDialogs } from "~/hooks/use-bookmark-dialogs";
import { useBookmarkKeyboardNavigation } from "~/hooks/use-bookmark-keyboard";
import { useBookmarkSelection } from "~/hooks/use-bookmark-selection";
import { useBookmarks } from "~/hooks/use-bookmarks";
import { useLatestRef } from "~/hooks/use-latest-ref";
import { useWorkspaces } from "~/hooks/use-workspaces";
import type { Bookmark } from "~/lib/schemas/bookmark";
import { normalizeUrl } from "~/lib/utils";
import { BookmarkDeleteDialog } from "./bookmark-delete-dialog";
import { BookmarkHeader } from "./bookmark-header";
import { BookmarkList } from "./bookmark-list";
import { BookmarkMoveDialog } from "./bookmark-move-dialog";
import { BookmarkRenameDialog } from "./bookmark-rename-dialog";
import { BookmarkToolbar } from "./bookmark-toolbar";

export function BookmarkView() {
  const [view, setView] = useState<"list" | "card">("list");
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

  const {
    renameDialogOpen,
    setRenameDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    moveDialogOpen,
    setMoveDialogOpen,
    activeBookmark,
    bookmarksToDelete,
    bookmarksToMove,
    handleDeleteTrigger,
    handleBulkDeleteTrigger,
    handleRenameTrigger,
    handleMoveTrigger,
    handleBulkMoveTrigger,
  } = useBookmarkDialogs();

  const { focusedIndex, inputRef, handleKeyDown } =
    useBookmarkKeyboardNavigation({
      itemCount: filteredBookmarks.length,
      view,
      isSelectionMode,
      onSelect: toggleSelect,
      onOpen: (url) => window.open(url, "_blank"),
    });

  // Global keyboard handler with useLatestRef for stale closures
  const filteredBookmarksRef = useLatestRef(filteredBookmarks);
  const isSelectionModeRef = useLatestRef(isSelectionMode);
  const focusedIndexRef = useLatestRef(focusedIndex);
  const deleteDialogOpenRef = useRef(false);
  const renameDialogOpenRef = useRef(false);

  useEffect(() => {
    deleteDialogOpenRef.current = deleteDialogOpen;
    renameDialogOpenRef.current = renameDialogOpen;
  }, [deleteDialogOpen, renameDialogOpen]);

  // Global keyboard shortcuts handler
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (renameDialogOpenRef.current) return;

      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement === inputRef.current ||
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA";

      if (isInputFocused) {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          e.preventDefault();
          inputRef.current?.focus();
          return;
        }
        if (e.metaKey || e.ctrlKey) return;
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      const items = filteredBookmarksRef.current;
      if (items.length === 0) return;

      const activeIdx = focusedIndexRef.current;

      if (isSelectionModeRef.current) {
        if ((e.metaKey || e.ctrlKey) && e.key === "a") {
          e.preventDefault();
          const allIds = items.map((b: Bookmark) => b.id);
          selectAll(allIds);
          return;
        }
        if (e.key === " " && activeIdx >= 0) {
          e.preventDefault();
          const item = items[activeIdx];
          if (item) toggleSelect(item.id);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          clearSelection();
          return;
        }
      }

      if (activeIdx >= 0) {
        const item = items[activeIdx];
        if (!item) return;

        if ((e.metaKey || e.ctrlKey) && e.key === "c") {
          e.preventDefault();
          navigator.clipboard.writeText(item.url);
          toast.success("URL copied to clipboard");
          return;
        }

        if ((e.metaKey || e.ctrlKey) && e.key === "e") {
          e.preventDefault();
          handleRenameTrigger(item.id, filteredBookmarksRef.current);
          return;
        }

        if ((e.metaKey || e.ctrlKey) && e.key === "Backspace") {
          e.preventDefault();
          handleBulkDeleteTrigger([item.id]);
          return;
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    selectAll,
    toggleSelect,
    clearSelection,
    handleRenameTrigger,
    handleBulkDeleteTrigger,
    inputRef,
  ]);

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
            if (res.success) {
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

  const handleSubmit = async (val: string) => {
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
  };

  const handleRename = useCallback(
    (id: string) => {
      handleRenameTrigger(id, filteredBookmarks);
    },
    [filteredBookmarks, handleRenameTrigger],
  );

  const getItem = useCallback(
    (index: number) => {
      const bookmark = filteredBookmarks[index];
      if (bookmark) {
        return { id: bookmark.id, url: bookmark.url };
      }
      return undefined;
    },
    [filteredBookmarks],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      handleKeyDown(e, getItem);
    },
    [handleKeyDown, getItem],
  );

  const isAllSelected =
    selectedIds.length === filteredBookmarks.length &&
    filteredBookmarks.length > 0;

  return (
    <section
      aria-label="Bookmarks"
      className="max-w-2xl mx-auto py-8 px-4 md:px-6 space-y-6 relative outline-none"
      onKeyDown={onKeyDown}
    >
      <BookmarkHeader
        inputRef={inputRef}
        view={view}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSubmit={handleSubmit}
        onViewChange={setView}
      />

      <BookmarkList
        view={view}
        isLoading={isLoading}
        searchQuery={searchQuery}
        filteredBookmarks={filteredBookmarks}
        pendingUrls={pendingUrls}
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspace?.id}
        selectedIds={selectedIds}
        isSelectionMode={isSelectionMode}
        focusedIndex={focusedIndex}
        onSelect={toggleSelect}
        onDelete={handleDeleteTrigger}
        onRename={handleRename}
        onMove={handleMoveTrigger}
        onMoveToWorkspace={handleMoveToWorkspace}
        onCopyUrl={handleCopyUrl}
        onRefetch={handleRefetchTrigger}
        onSelectionModeToggle={toggleSelectionMode}
        autoCheckBroken={currentWorkspace?.auto_check_broken !== false}
      />

      <BookmarkToolbar
        selectedCount={selectedIds.length}
        isSelectionMode={isSelectionMode}
        isAllSelected={isAllSelected}
        onClear={clearSelection}
        onToggleSelectAll={
          isAllSelected
            ? clearSelectionOnly
            : () => selectAll(filteredBookmarks.map((b: Bookmark) => b.id))
        }
        onDelete={() => handleBulkDeleteTrigger(selectedIds)}
        onMove={() => handleBulkMoveTrigger(selectedIds)}
        onCopyUrls={handleBulkCopyUrls}
      />

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
          if (bookmarksToDelete.length > 0) clearSelection();
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
          if (bookmarksToMove.length > 0) clearSelection();
        }}
      />
    </section>
  );
}
