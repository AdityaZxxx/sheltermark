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
import type { WorkspaceWithCount } from "~/lib/schemas/workspace.schema";

export function useBookmarkViewModel() {
  const [view, setView] = useState<"list" | "card">("list");

  const { workspaces, currentWorkspace } = useWorkspaces();
  const {
    bookmarks,
    isLoading,
    searchQuery,
    setSearchQuery,
    sort,
    setSort,
    invalidate,
  } = useBookmarks(currentWorkspace?.id);

  const mutations = useBookmarkMutations();

  const selection = useBookmarkSelection();
  const dialogs = useBookmarkDialogs();
  const { focusedIndex, inputRef, handleKeyDown } =
    useBookmarkKeyboardNavigation({
      itemCount: bookmarks.length,
      view,
      isSelectionMode: selection.isSelectionMode,
      onSelect: selection.toggleSelect,
      onOpen: (url) => window.open(url, "_blank"),
    });

  const { pendingUrls, setPendingUrls } = usePendingBookmarks(bookmarks);

  const {
    handleCopyUrl,
    handleBulkCopyUrls,
    handleRefetchTrigger,
    handleMoveToWorkspace,
    handleSubmit,
  } = useBookmarkActions({
    selectedIds: selection.selectedIds,
    filteredBookmarks: bookmarks,
    currentWorkspace,
    workspaces: workspaces as WorkspaceWithCount[],
    addBookmark: mutations.addBookmark,
    moveBookmarks: mutations.moveBookmarks,
    refetchBookmarkMetadata: mutations.refetchBookmarkMetadata,
    invalidate,
    setSearchQuery,
    setPendingUrls,
  });

  useBookmarkGlobalShortcuts({
    inputRef,
    filteredBookmarks: bookmarks,
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
      dialogs.handleRenameTrigger(id, bookmarks);
    },
    [bookmarks, dialogs.handleRenameTrigger],
  );

  const handleNote = useCallback(
    (id: string) => {
      dialogs.handleNoteTrigger(id, bookmarks);
    },
    [bookmarks, dialogs.handleNoteTrigger],
  );

  const getItem = useCallback(
    (index: number) => {
      const bookmark = bookmarks[index];
      if (bookmark) {
        return { id: bookmark.id, url: bookmark.url };
      }
      return undefined;
    },
    [bookmarks],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      handleKeyDown(e, getItem);
    },
    [handleKeyDown, getItem],
  );

  const isAllSelected =
    selection.selectedIds.length === bookmarks.length && bookmarks.length > 0;

  return {
    // state
    view,
    setView,
    isLoading,
    searchQuery,
    setSearchQuery,
    sort,
    setSort,
    // data
    bookmarks,
    workspaces,
    currentWorkspace,
    pendingUrls,
    // selection
    selection,
    isAllSelected,
    focusedIndex,
    inputRef,
    // actions
    handleSubmit,
    handleCopyUrl,
    handleBulkCopyUrls,
    handleRefetchTrigger,
    handleMoveToWorkspace,
    handleRename,
    handleNote,
    onKeyDown,
    onDeleteTrigger: dialogs.handleDeleteTrigger,
    onBulkDeleteTrigger: () =>
      dialogs.handleBulkDeleteTrigger(selection.selectedIds),
    onBulkMoveTrigger: () =>
      dialogs.handleBulkMoveTrigger(selection.selectedIds),
    invalidate,
    // dialogs
    dialogs,
  };
}
