"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

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
import { useWorkspaceIdParam } from "~/hooks/use-workspaces";

import { BookmarkEditDialog } from "./bookmark-edit-dialog";
import { BookmarkHeader } from "./bookmark-header";
import { BookmarkList } from "./bookmark-list";
import { BookmarkMoveDialog } from "./bookmark-move-dialog";
import { BookmarkPreview } from "./bookmark-preview";
import { BookmarkToolbar } from "./bookmark-toolbar";

// Desktop/mobile split via useSyncExternalStore: no effect → no post-mount
// setState → the preview panel mounts exactly once (a false→true isMobile
// flip after mount double-mounted BookmarkPreview and re-ran its probe).
function useIsMobile(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(max-width: 767px)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
}

export function BookmarkView() {
  const [workspaceIdParam] = useWorkspaceIdParam();
  const effectiveScope: BookmarkScope = workspaceIdParam
    ? { type: "workspace", id: workspaceIdParam }
    : { type: "global" };
  const sectionRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // The virtualizer reads scrollRef during layout effects that run before this
  // ref is populated, and only re-checks the element on a re-render. A
  // desktop ↔ mobile flip can swap the scroll element without re-rendering
  // VirtualList, leaving it observing a detached node — rows vanish until some
  // unrelated re-render (or a manual refresh). Bumping state on every element
  // identity change guarantees the re-render happens.
  const [, setScrollVersion] = useState(0);
  const setScrollRef = useCallback((el: HTMLDivElement | null) => {
    if (scrollRef.current !== el) {
      scrollRef.current = el;
      setScrollVersion((v) => v + 1);
    }
  }, []);
  const vm = useBookmarkListManager(effectiveScope, sectionRef);
  const { tags: allTags } = useUserTagsWithCount();
  const isMobile = useIsMobile();

  const listColumn = (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
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
            filterTags={vm.workspaceTags}
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
          ref={setScrollRef}
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
            currentWorkspaceId={vm.workspaceContext.currentWorkspaceId}
            workspaceNameById={vm.workspaceContext.workspaceNameById}
            availableWorkspaces={vm.workspaceContext.availableWorkspaces}
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

  // The list panel stays mounted in the same PanelGroup in both branches —
  // reparenting listColumn between layouts (desktop ↔ mobile) remounts
  // VirtualList and leaves @tanstack/react-virtual observing a detached
  // scroll element, so the rows vanish until a full page reload.
  return (
    <section ref={sectionRef} aria-label="Bookmarks" className={sectionClass}>
      <ResizablePanelGroup
        orientation="horizontal"
        className="min-h-0 w-full flex-1"
      >
        <ResizablePanel defaultSize="100%" minSize="25%">
          {listColumn}
        </ResizablePanel>
        {vm.previewBookmark && !isMobile && (
          <>
            <ResizableHandle />
            <ResizablePanel defaultSize="50%" minSize="30%">
              <BookmarkPreview
                key={vm.previewBookmark.id}
                bookmark={vm.previewBookmark}
                onClose={vm.closePreview}
                nav={{
                  onPrev: () => vm.stepPreview(-1),
                  onNext: () => vm.stepPreview(1),
                  hasPrev: vm.hasPrevPreview,
                  hasNext: vm.hasNextPreview,
                }}
                mode={vm.previewMode}
                onModeChange={vm.setPreviewMode}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
      {vm.previewBookmark && isMobile && (
        <BookmarkPreview
          key={vm.previewBookmark.id}
          bookmark={vm.previewBookmark}
          onClose={vm.closePreview}
          nav={{
            onPrev: () => vm.stepPreview(-1),
            onNext: () => vm.stepPreview(1),
            hasPrev: vm.hasPrevPreview,
            hasNext: vm.hasNextPreview,
          }}
          mode={vm.previewMode}
          onModeChange={vm.setPreviewMode}
        />
      )}
      {dialogs}
    </section>
  );
}
