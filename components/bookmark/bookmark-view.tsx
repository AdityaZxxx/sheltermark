"use client";

import { useBookmarkViewModel } from "~/hooks/use-bookmark-view-model";
import { BookmarkDeleteDialog } from "./bookmark-delete-dialog";
import { BookmarkEditDialog } from "./bookmark-edit-dialog";
import { BookmarkHeader } from "./bookmark-header";
import { BookmarkList } from "./bookmark-list";
import { BookmarkMoveDialog } from "./bookmark-move-dialog";
import { BookmarkToolbar } from "./bookmark-toolbar";

export function BookmarkView() {
  const vm = useBookmarkViewModel();

  return (
    <section
      aria-label="Bookmarks"
      className="max-w-2xl mx-auto py-8 px-4 md:px-6 space-y-6 relative outline-none"
      onKeyDown={vm.onKeyDown}
    >
      <BookmarkHeader
        inputRef={vm.inputRef}
        view={vm.view}
        searchQuery={vm.searchQuery}
        sort={vm.sort}
        selectedTagIds={vm.selectedTagIds}
        onSearchChange={vm.setSearchQuery}
        onSubmit={vm.handleSubmit}
        onViewChange={vm.setView}
        onSortChange={vm.setSort}
        onTagFilterChange={vm.setSelectedTagIds}
      />

      <BookmarkList
        view={vm.view}
        isLoading={vm.isLoading}
        searchQuery={vm.searchQuery}
        filteredBookmarks={vm.bookmarks}
        pendingUrls={vm.pendingUrls}
        workspaces={vm.workspaces}
        currentWorkspaceId={vm.currentWorkspace?.id}
        selectedIds={vm.selection.selectedIds}
        isSelectionMode={vm.selection.isSelectionMode}
        focusedIndex={vm.focusedIndex}
        onSelect={vm.selection.toggleSelect}
        onDelete={vm.onDeleteTrigger}
        onEdit={vm.handleEdit}
        onTagClick={(tagId) => vm.setSelectedTagIds([tagId])}
        onMove={vm.dialogs.handleMoveTrigger}
        onMoveToWorkspace={vm.handleMoveToWorkspace}
        onCopyUrl={vm.handleCopyUrl}
        onRefetch={vm.handleRefetchTrigger}
        onSelectionModeToggle={vm.selection.toggleSelectionMode}
        autoCheckBroken={vm.currentWorkspace?.auto_check_broken !== false}
        tagsByBookmarkId={vm.tagsByBookmarkId}
        allTags={vm.allTags}
      />

      <BookmarkToolbar
        selectedCount={vm.selection.selectedIds.length}
        isSelectionMode={vm.selection.isSelectionMode}
        isAllSelected={vm.isAllSelected}
        onClear={vm.selection.clearSelection}
        onToggleSelectAll={
          vm.isAllSelected
            ? vm.selection.clearSelectionOnly
            : () => vm.selection.selectAll(vm.bookmarks.map((b) => b.id))
        }
        onDelete={vm.onBulkDeleteTrigger}
        onMove={vm.onBulkMoveTrigger}
        onCopyUrls={vm.handleBulkCopyUrls}
      />

      <BookmarkEditDialog
        open={vm.dialogs.editDialogOpen}
        onOpenChange={vm.dialogs.setEditDialogOpen}
        bookmark={vm.dialogs.activeBookmark}
        onSuccess={vm.invalidate}
      />

      <BookmarkDeleteDialog
        open={vm.dialogs.deleteDialogOpen}
        onOpenChange={vm.dialogs.setDeleteDialogOpen}
        ids={vm.dialogs.bookmarksToDelete}
        onSuccess={() => {
          vm.invalidate();
          if (vm.dialogs.bookmarksToDelete.length > 0)
            vm.selection.clearSelection();
        }}
      />

      <BookmarkMoveDialog
        open={vm.dialogs.moveDialogOpen}
        onOpenChange={vm.dialogs.setMoveDialogOpen}
        ids={vm.dialogs.bookmarksToMove}
        workspaces={vm.workspaces}
        currentWorkspaceId={vm.currentWorkspace?.id}
        onSuccess={() => {
          vm.invalidate();
          if (vm.dialogs.bookmarksToMove.length > 0)
            vm.selection.clearSelection();
        }}
      />
    </section>
  );
}
