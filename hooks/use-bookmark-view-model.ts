"use client";

import { useCallback, useState } from "react";
import { useBookmarkActions } from "~/hooks/use-bookmark-actions";
import { useBookmarkDialogs } from "~/hooks/use-bookmark-dialogs";
import { useBookmarkGlobalShortcuts } from "~/hooks/use-bookmark-global-shortcuts";
import { useBookmarkKeyboardNavigation } from "~/hooks/use-bookmark-keyboard";
import { useBookmarkSelection } from "~/hooks/use-bookmark-selection";
import { useBookmarkMutations, useBookmarks } from "~/hooks/use-bookmarks";
import { useViewPreference } from "~/hooks/use-view-preference";
import { useWorkspaces } from "~/hooks/use-workspaces";
import type { BookmarkScope } from "~/lib/schemas/common";
import type { WorkspaceWithCount } from "~/lib/schemas/workspace.schema";

export function useBookmarkViewModel(scope: BookmarkScope) {
  const { view, setView } = useViewPreference();
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
  } = useBookmarks(scope.type === "workspace" ? scope.id : undefined);

  const mutations = useBookmarkMutations();
  const {
    isDeletingBookmarks,
    isMovingBookmarks,
    updateBookmarkFields,
    isUpdatingBookmarkFields,
    refetchingId,
  } = mutations;

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
    setView,
    isLoading,
    searchQuery,
    setSearchQuery,
    sort,
    setSort,
    bookmarks,
    workspaces,
    currentWorkspace,
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
    toolbarPendingAction: isDeletingBookmarks
      ? ("deleting" as const)
      : isMovingBookmarks
        ? ("moving" as const)
        : null,
    refetchingId,
    updateBookmarkFields,
    isUpdatingBookmarkFields,
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
