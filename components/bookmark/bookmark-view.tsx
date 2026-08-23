"use client";

import type { BookmarkScope } from "~/lib/schemas/common";

import { TagManageDialog } from "~/components/tag/tag-manage-dialog";
import { useBookmarkListManager } from "~/hooks/use-bookmark-list-manager";

import { BookmarkEditDialog } from "./bookmark-edit-dialog";
import { BookmarkHeader } from "./bookmark-header";
import { BookmarkList } from "./bookmark-list";
import { BookmarkMoveDialog } from "./bookmark-move-dialog";
import { BookmarkToolbar } from "./bookmark-toolbar";

export function BookmarkView({ scope }: { scope: BookmarkScope }) {
  const vm = useBookmarkListManager(scope);

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- container-level keyboard shortcut dispatch for bookmark list navigation; no interactive semantics needed
    <section
      aria-label="Bookmarks"
      className="max-w-3xl mx-auto py-8 px-4 md:px-6 space-y-6 relative outline-none"
      onKeyDown={vm.onKeyDown}
    >
      <BookmarkHeader
        inputRef={vm.inputRef}
        view={vm.view}
        searchQuery={vm.searchQuery}
        sort={vm.sort}
        count={vm.bookmarks.length}
        title={vm.currentWorkspace?.name ?? "All Bookmarks"}
        selectedTagIds={vm.selectedTagIds}
        workspaceId={vm.currentWorkspace?.id}
        onSearchChange={vm.setSearchQuery}
        onSubmit={vm.handleSubmit}
        onViewChange={vm.setView}
        onSortChange={vm.setSort}
        onTagFilterChange={vm.setSelectedTagIds}
        onManageTags={() => vm.setManageTagsDialogOpen(true)}
      />

      <BookmarkList
        view={vm.view}
        isLoading={vm.isLoading}
        searchQuery={vm.searchQuery}
        filteredBookmarks={vm.bookmarks}
        workspaces={vm.workspaces}
        currentWorkspaceId={vm.currentWorkspace?.id}
        selectedIds={vm.selection.selectedIds}
        isSelectionMode={vm.selection.isSelectionMode}
        focusedIndex={vm.focusedIndex}
        onSelect={vm.selection.toggleSelect}
        onDelete={vm.dialogs.handleDeleteTrigger}
        onEdit={vm.dialogs.handleEditTrigger}
        onTagClick={(tagId) => vm.setSelectedTagIds([tagId])}
        onMove={vm.dialogs.handleMoveTrigger}
        onMoveToWorkspace={vm.handleMoveToWorkspace}
        onCopyUrl={vm.handleCopyUrl}
        onRefetch={vm.handleRefetchTrigger}
        onSelectionModeToggle={vm.selection.toggleSelectionMode}
        autoCheckBroken={vm.currentWorkspace?.auto_check_broken !== false}
        tagsByBookmarkId={vm.tagsByBookmarkId}
        allTags={vm.allTags}
        refetchingId={vm.refetchingId}
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
        onDelete={vm.dialogs.handleBulkDeleteTrigger}
        onMove={vm.dialogs.handleBulkMoveTrigger}
        onCopyUrls={vm.handleBulkCopyUrls}
        pendingAction={vm.toolbarPendingAction}
      />

      <BookmarkEditDialog
        open={vm.dialogs.editDialogOpen}
        onOpenChange={vm.dialogs.setEditDialogOpen}
        bookmark={vm.dialogs.activeBookmark}
        updateBookmarkFields={vm.updateBookmarkFields}
        isPending={vm.isUpdatingBookmarkFields}
      />

      <BookmarkMoveDialog
        open={vm.dialogs.moveDialogOpen}
        onOpenChange={vm.dialogs.setMoveDialogOpen}
        ids={vm.dialogs.bookmarksToMove}
        workspaces={vm.workspaces}
        currentWorkspaceId={vm.currentWorkspace?.id}
        onSuccess={() => {
          if (vm.dialogs.bookmarksToMove.length > 0)
            vm.selection.clearSelection();
        }}
      />

      <TagManageDialog
        open={vm.manageTagsDialogOpen}
        onOpenChange={vm.setManageTagsDialogOpen}
        workspaceId={vm.currentWorkspace?.id}
      />
    </section>
  );
}
