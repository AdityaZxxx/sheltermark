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
import type { BookmarkViewVariant } from "~/lib/schemas/common";
import type { WorkspaceWithCount } from "~/lib/schemas/workspace.schema";

const VIEW_PREFERENCE_KEY = "sheltermark-view-preference";

function getStoredViewPreference(): BookmarkViewVariant {
  if (typeof window === "undefined") return "list";
  try {
    const stored = localStorage.getItem(VIEW_PREFERENCE_KEY);
    const valid: BookmarkViewVariant[] = ["list", "card", "comfort"];
    if (stored && valid.includes(stored as BookmarkViewVariant)) {
      return stored as BookmarkViewVariant;
    }
  } catch {
    // localStorage may be blocked
  }
  return "list";
}

export function useBookmarkViewModel() {
  const [view, setView] = useState<BookmarkViewVariant>(
    getStoredViewPreference,
  );

  const handleViewChange = useCallback((newView: BookmarkViewVariant) => {
    setView(newView);
    try {
      localStorage.setItem(VIEW_PREFERENCE_KEY, newView);
    } catch {
      // localStorage may be blocked
    }
  }, []);
  const [manageTagsDialogOpen, setManageTagsDialogOpen] = useState(false);

  const { workspaces, currentWorkspace } = useWorkspaces();
  const {
    bookmarks,
    isLoading,
    searchQuery,
    setSearchQuery,
    sort,
    setSort,
    invalidate,
    allTags,
    tagsByBookmarkId,
    selectedTagIds,
    setSelectedTagIds,
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
    tagsByBookmarkId,
    allTags,
    focusedIndex,
    isSelectionMode: selection.isSelectionMode,
    editDialogOpen: dialogs.editDialogOpen,
    deleteDialogOpen: dialogs.deleteDialogOpen,
    selectAll: selection.selectAll,
    toggleSelect: selection.toggleSelect,
    clearSelection: selection.clearSelection,
    handleEditTrigger: dialogs.handleEditTrigger,
    handleBulkDeleteTrigger: dialogs.handleBulkDeleteTrigger,
  });

  const handleEdit = useCallback(
    (id: string) => {
      dialogs.handleEditTrigger(
        id,
        bookmarks.map((b) => ({
          id: b.id,
          title: b.title,
          note: b.note,
          tagsByBookmarkId,
          allTags,
        })),
      );
    },
    [bookmarks, tagsByBookmarkId, allTags, dialogs],
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
    view,
    setView: handleViewChange,
    isLoading,
    searchQuery,
    setSearchQuery,
    sort,
    setSort,
    bookmarks,
    workspaces,
    currentWorkspace,
    pendingUrls,
    selection,
    isAllSelected,
    focusedIndex,
    inputRef,
    handleSubmit,
    handleCopyUrl,
    handleBulkCopyUrls,
    handleRefetchTrigger,
    handleMoveToWorkspace,
    handleEdit,
    onKeyDown,
    onDeleteTrigger: dialogs.handleDeleteTrigger,
    onBulkDeleteTrigger: () =>
      dialogs.handleBulkDeleteTrigger(selection.selectedIds),
    onBulkMoveTrigger: () =>
      dialogs.handleBulkMoveTrigger(selection.selectedIds),
    invalidate,
    dialogs,
    manageTagsDialogOpen,
    setManageTagsDialogOpen,
    allTags,
    tagsByBookmarkId,
    selectedTagIds,
    setSelectedTagIds,
  };
}
