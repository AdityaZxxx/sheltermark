"use client";

import { useCallback, useState } from "react";
import { useBookmarkActions } from "~/hooks/use-bookmark-actions";
import { useBookmarkDialogs } from "~/hooks/use-bookmark-dialogs";
import { useBookmarkGlobalShortcuts } from "~/hooks/use-bookmark-global-shortcuts";
import { useBookmarkKeyboardNavigation } from "~/hooks/use-bookmark-keyboard";
import { useBookmarkSelection } from "~/hooks/use-bookmark-selection";
import { useBookmarkMutations, useBookmarks } from "~/hooks/use-bookmarks";
import { usePendingBookmarks } from "~/hooks/use-pending-bookmarks";
import { useWorkspaces } from "~/hooks/use-workspaces";
import type { Bookmark } from "~/lib/schemas/bookmark";
import type { WorkspaceWithCount } from "~/lib/schemas/workspace";
import { BookmarkDeleteDialog } from "./bookmark-delete-dialog";
import { BookmarkHeader } from "./bookmark-header";
import { BookmarkList } from "./bookmark-list";
import { BookmarkMoveDialog } from "./bookmark-move-dialog";
import { BookmarkRenameDialog } from "./bookmark-rename-dialog";
import { BookmarkToolbar } from "./bookmark-toolbar";

export function BookmarkView() {
  const [view, setView] = useState<"list" | "card">("list");

  const { workspaces, currentWorkspace } = useWorkspaces();
  const {
    filteredBookmarks,
    isLoading,
    searchQuery,
    setSearchQuery,
    sort,
    setSort,
    invalidate,
  } = useBookmarks(currentWorkspace?.id);

  // Ensure mutation return shape is correctly typed
  const mutations = useBookmarkMutations();
  const { addBookmark, moveBookmarks, refetchBookmarkMetadata } =
    mutations as unknown as {
      addBookmark: (payload: { url: string; workspaceId: string }) => void;
      moveBookmarks: (payload: {
        ids: string[];
        targetWorkspaceId: string;
      }) => void;
      refetchBookmarkMetadata: (payload: { id: string }) => void;
    };

  const selection = useBookmarkSelection();
  const dialogs = useBookmarkDialogs();
  const { focusedIndex, inputRef, handleKeyDown } =
    useBookmarkKeyboardNavigation({
      itemCount: filteredBookmarks.length,
      view,
      isSelectionMode: selection.isSelectionMode,
      onSelect: selection.toggleSelect,
      onOpen: (url) => window.open(url, "_blank"),
    });

  const { pendingUrls, setPendingUrls } =
    usePendingBookmarks(filteredBookmarks);

  const {
    handleCopyUrl,
    handleBulkCopyUrls,
    handleRefetchTrigger,
    handleMoveToWorkspace,
    handleSubmit,
  } = useBookmarkActions({
    selectedIds: selection.selectedIds,
    filteredBookmarks,
    currentWorkspace,
    // Cast to the expected type to satisfy TS after hook fixes
    workspaces: workspaces as WorkspaceWithCount[],
    addBookmark,
    moveBookmarks,
    refetchBookmarkMetadata,
    invalidate,
    setSearchQuery,
    setPendingUrls,
  });

  useBookmarkGlobalShortcuts({
    inputRef,
    filteredBookmarks,
    focusedIndex,
    isSelectionMode: selection.isSelectionMode,
    renameDialogOpen: dialogs.renameDialogOpen,
    deleteDialogOpen: dialogs.deleteDialogOpen,
    selectAll: selection.selectAll,
    toggleSelect: selection.toggleSelect,
    clearSelection: selection.clearSelection,
    handleRenameTrigger: dialogs.handleRenameTrigger,
    handleBulkDeleteTrigger: dialogs.handleBulkDeleteTrigger,
  });

  const handleRename = useCallback(
    (id: string) => {
      dialogs.handleRenameTrigger(id, filteredBookmarks);
    },
    [filteredBookmarks, dialogs.handleRenameTrigger],
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
    selection.selectedIds.length === filteredBookmarks.length &&
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
        sort={sort}
        onSearchChange={setSearchQuery}
        onSubmit={handleSubmit}
        onViewChange={setView}
        onSortChange={setSort}
      />

      <BookmarkList
        view={view}
        isLoading={isLoading}
        searchQuery={searchQuery}
        filteredBookmarks={filteredBookmarks}
        pendingUrls={pendingUrls}
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspace?.id}
        selectedIds={selection.selectedIds}
        isSelectionMode={selection.isSelectionMode}
        focusedIndex={focusedIndex}
        onSelect={selection.toggleSelect}
        onDelete={dialogs.handleDeleteTrigger}
        onRename={handleRename}
        onMove={dialogs.handleMoveTrigger}
        onMoveToWorkspace={handleMoveToWorkspace}
        onCopyUrl={handleCopyUrl}
        onRefetch={handleRefetchTrigger}
        onSelectionModeToggle={selection.toggleSelectionMode}
        autoCheckBroken={currentWorkspace?.auto_check_broken !== false}
      />

      <BookmarkToolbar
        selectedCount={selection.selectedIds.length}
        isSelectionMode={selection.isSelectionMode}
        isAllSelected={isAllSelected}
        onClear={selection.clearSelection}
        onToggleSelectAll={
          isAllSelected
            ? selection.clearSelectionOnly
            : () =>
                selection.selectAll(
                  filteredBookmarks.map((b: Bookmark) => b.id),
                )
        }
        onDelete={() => dialogs.handleBulkDeleteTrigger(selection.selectedIds)}
        onMove={() => dialogs.handleBulkMoveTrigger(selection.selectedIds)}
        onCopyUrls={handleBulkCopyUrls}
      />

      <BookmarkRenameDialog
        open={dialogs.renameDialogOpen}
        onOpenChange={dialogs.setRenameDialogOpen}
        bookmark={dialogs.activeBookmark}
        onSuccess={invalidate}
      />

      <BookmarkDeleteDialog
        open={dialogs.deleteDialogOpen}
        onOpenChange={dialogs.setDeleteDialogOpen}
        ids={dialogs.bookmarksToDelete}
        onSuccess={() => {
          invalidate();
          if (dialogs.bookmarksToDelete.length > 0) selection.clearSelection();
        }}
      />

      <BookmarkMoveDialog
        open={dialogs.moveDialogOpen}
        onOpenChange={dialogs.setMoveDialogOpen}
        ids={dialogs.bookmarksToMove}
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspace?.id}
        onSuccess={() => {
          invalidate();
          if (dialogs.bookmarksToMove.length > 0) selection.clearSelection();
        }}
      />
    </section>
  );
}
