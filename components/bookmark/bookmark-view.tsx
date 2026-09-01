"use client";

import { useEffect, useRef, useState } from "react";

import type { BookmarkScope } from "~/lib/schemas/common";

import { KeyboardShortcutsDialog } from "~/components/settings/keyboard-shortcuts-dialog";
import { TagManageDialog } from "~/components/tag/tag-manage-dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/components/ui/resizable";
import { useBookmarkListManager } from "~/hooks/use-bookmark-list-manager";
import { useUserTagsWithCount } from "~/hooks/use-tags";

import { BookmarkEditDialog } from "./bookmark-edit-dialog";
import { BookmarkHeader } from "./bookmark-header";
import { BookmarkList } from "./bookmark-list";
import { BookmarkMoveDialog } from "./bookmark-move-dialog";
import { BookmarkPreview } from "./bookmark-preview";
import { BookmarkToolbar } from "./bookmark-toolbar";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent | MediaQueryList) =>
      // oxlint-disable-next-line react/set-state-in-effect -- breakpoint lives in the browser, unknowable during SSR/render; syncing post-mount prevents a server/client mismatch
      setIsMobile(e.matches);
    onChange(mq);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

export function BookmarkView({ scope }: { scope: BookmarkScope }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const vm = useBookmarkListManager(scope, sectionRef);
  const { tags: allTags } = useUserTagsWithCount();
  const isMobile = useIsMobile();

  const listColumn = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 min-h-0 flex-col px-4 pt-8 md:px-6">
        <div className="shrink-0">
          <BookmarkHeader
            inputRef={vm.inputRef}
            view={vm.view}
            searchQuery={vm.searchQuery}
            sort={vm.sort}
            count={vm.bookmarks.length}
            title={vm.currentWorkspace?.name ?? "All Bookmarks"}
            selectedTagIds={vm.selectedTagIds}
            workspaceId={vm.currentWorkspace?.id}
            aiSearchTerms={vm.aiSearchTerms}
            onAskAi={vm.handleAskAi}
            isAskingAi={vm.isAiSearching}
            onSearchChange={vm.setSearchQuery}
            onSubmit={vm.handleSubmit}
            onViewChange={vm.setView}
            onSortChange={vm.setSort}
            onTagFilterChange={vm.setSelectedTagIds}
            onManageTags={() => vm.setManageTagsDialogOpen(true)}
          />
        </div>

        <div
          ref={scrollRef}
          data-virtual-scroll
          className="scroll-fade mt-6 min-h-0 flex-1 overflow-y-auto pb-8"
          style={{ contain: "layout paint style" }}
        >
          <BookmarkList
            scrollRef={scrollRef}
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
            onOpen={vm.openPreview}
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
            filterKey={vm.filterKey}
          />
        </div>

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
      </div>
    </div>
  );

  const dialogs = (
    <>
      <BookmarkEditDialog
        open={vm.dialogs.editDialogOpen}
        onOpenChange={vm.dialogs.setEditDialogOpen}
        bookmark={vm.dialogs.activeBookmark}
        allTags={allTags}
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

      <KeyboardShortcutsDialog
        open={vm.shortcutsOpen}
        onOpenChange={vm.setShortcutsOpen}
      />
    </>
  );

  const sectionClass =
    "relative flex min-h-0 flex-1 flex-col outline-none md:flex-row";

  if (isMobile) {
    return (
      <section ref={sectionRef} aria-label="Bookmarks" className={sectionClass}>
        {listColumn}
        {vm.previewBookmark && (
          <BookmarkPreview
            key={vm.previewBookmark.id}
            bookmark={vm.previewBookmark}
            onClose={vm.closePreview}
          />
        )}
        {dialogs}
      </section>
    );
  }

  // Desktop: the list panel stays mounted in the same PanelGroup whether the
  // preview is open or not — reparenting the list between layouts leaves
  // @tanstack/react-virtual observing a detached scroll element and the
  // rows vanish until a full page reload.
  return (
    <section ref={sectionRef} aria-label="Bookmarks" className={sectionClass}>
      <ResizablePanelGroup
        orientation="horizontal"
        className="min-h-0 w-full flex-1"
      >
        <ResizablePanel defaultSize="100%" minSize="25%">
          {listColumn}
        </ResizablePanel>
        {vm.previewBookmark && (
          <>
            <ResizableHandle />
            <ResizablePanel defaultSize="42%" minSize="20%">
              <BookmarkPreview
                key={vm.previewBookmark.id}
                bookmark={vm.previewBookmark}
                onClose={vm.closePreview}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
      {dialogs}
    </section>
  );
}
