"use client";

import { useCallback, useState } from "react";
import { BookmarkCardItem } from "~/components/bookmark/bookmark-card-item";
import { BookmarkDeleteDialog } from "~/components/bookmark/bookmark-delete-dialog";
import { BookmarkInput } from "~/components/bookmark/bookmark-input";
import { BookmarkListItem } from "~/components/bookmark/bookmark-list-item";
import { BookmarkMoveDialog } from "~/components/bookmark/bookmark-move-dialog";
import { BookmarkRenameDialog } from "~/components/bookmark/bookmark-rename-dialog";
import { BookmarkToolbar } from "~/components/bookmark/bookmark-toolbar";
import { BookmarkViewToggle } from "~/components/bookmark/bookmark-view-toggle";
import { useBookmarkDialogs } from "~/hooks/use-bookmark-dialogs";
import { useBookmarkKeyboardNavigation } from "~/hooks/use-bookmark-keyboard";
import { useBookmarkSelection } from "~/hooks/use-bookmark-selection";
import { safeDomain } from "~/lib/utils";
import type { Bookmark } from "~/types/bookmark.types";
import type { Workspace } from "~/types/workspace.types";
import { DEMO_WORKSPACES, INITIAL_DEMO_BOOKMARKS } from "./demo-data";
import { DemoHeader } from "./demo-header";

export function DemoBookmarkView() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(
    INITIAL_DEMO_BOOKMARKS,
  );
  const [workspaces] = useState<Workspace[]>(DEMO_WORKSPACES);
  const [activeWorkspaceId, setActiveWorkspaceId] =
    useState<string>("personal");
  const [view, setView] = useState<"list" | "card">("list");
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredBookmarks = bookmarks.filter((b) => {
    const matchesWorkspace = b.workspace_id === activeWorkspaceId;
    const matchesSearch = searchQuery
      ? (b.title?.toLowerCase() ?? "").includes(searchQuery.toLowerCase()) ||
        b.url.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesWorkspace && matchesSearch;
  });

  const { focusedIndex, setFocusedIndex, inputRef, handleKeyDown } =
    useBookmarkKeyboardNavigation({
      itemCount: filteredBookmarks.length,
      view,
      onSelect: toggleSelect,
      onOpen: (url) => window.open(url, "_blank"),
      isSelectionMode,
    });

  const handleCopyUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url);
  }, []);

  const handleBulkCopyUrls = useCallback(() => {
    const urls = filteredBookmarks
      .filter((b) => selectedIds.includes(b.id))
      .map((b) => b.url)
      .join("\n");
    navigator.clipboard.writeText(urls);
  }, [selectedIds, filteredBookmarks]);

  const handleConfirmRename = useCallback((id: string, title: string) => {
    setBookmarks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, title } : b)),
    );
  }, []);

  const handleConfirmDelete = useCallback(
    (ids: string[]) => {
      setBookmarks((prev) => prev.filter((b) => !ids.includes(b.id)));
      if (ids.length > 1) {
        clearSelection();
      }
    },
    [clearSelection],
  );

  const handleConfirmMove = useCallback(
    (ids: string[], targetWorkspaceId: string) => {
      setBookmarks((prev) =>
        prev.map((b) =>
          ids.includes(b.id) ? { ...b, workspace_id: targetWorkspaceId } : b,
        ),
      );
      if (ids.length > 1) {
        clearSelection();
      }
    },
    [clearSelection],
  );

  const handleSubmit = async (val: string) => {
    const trimmed = val.trim();
    if (!trimmed.includes(".") && !trimmed.startsWith("http")) return;

    const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;

    try {
      const res = await fetch("/api/demo/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const metadata = await res.json();

      const newBookmark: Bookmark = {
        id: crypto.randomUUID(),
        title: metadata.title || url,
        url,
        description: metadata.description || null,
        favicon_url: metadata.favicon_url || null,
        og_image_url: metadata.og_image_url || null,
        domain: safeDomain(url),
        workspace_id: activeWorkspaceId || "personal",
        created_at: new Date().toISOString(),
      };

      setBookmarks((prev) => [newBookmark, ...prev]);
      setSearchQuery("");
    } catch {
      const newBookmark: Bookmark = {
        id: crypto.randomUUID(),
        title: url,
        url,
        description: null,
        favicon_url: null,
        og_image_url: null,
        domain: safeDomain(url),
        workspace_id: activeWorkspaceId || "personal",
        created_at: new Date().toISOString(),
      };

      setBookmarks((prev) => [newBookmark, ...prev]);
      setSearchQuery("");
    }
  };

  const onRenameTrigger = useCallback(
    (id: string) => {
      const bookmark = filteredBookmarks.find((b) => b.id === id);
      if (bookmark) {
        handleRenameTrigger(id, filteredBookmarks);
      }
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

  return (
    <div className="h-[500px] bg-background max-w-4xl mx-auto rounded-lg border">
      <DemoHeader
        workspaces={workspaces}
        currentWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={setActiveWorkspaceId}
      />

      <section
        aria-label="Demo Bookmarks"
        className="max-w-2xl mx-auto py-8 px-4 md:px-6 space-y-6 relative outline-none"
        onKeyDown={onKeyDown}
      >
        <div className="space-y-4 max-w-2xl mx-auto">
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

        <div
          className={
            view === "card"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "flex flex-col gap-1 max-w-2xl mx-auto"
          }
        >
          {filteredBookmarks.map((bookmark, index) =>
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
                  isSelected={
                    selectedIds.includes(bookmark.id) ||
                    (!isSelectionMode && focusedIndex === index)
                  }
                  isSelectionMode={isSelectionMode}
                  workspaces={workspaces}
                  currentWorkspaceId={bookmark.workspace_id}
                  onSelect={toggleSelect}
                  onDelete={handleDeleteTrigger}
                  onRename={onRenameTrigger}
                  onMove={handleMoveTrigger}
                  onMoveToWorkspace={(id, wsId) =>
                    handleConfirmMove([id], wsId)
                  }
                  onCopyUrl={handleCopyUrl}
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
                  isSelected={
                    selectedIds.includes(bookmark.id) ||
                    (!isSelectionMode && focusedIndex === index)
                  }
                  isSelectionMode={isSelectionMode}
                  workspaces={workspaces}
                  currentWorkspaceId={bookmark.workspace_id}
                  onSelect={toggleSelect}
                  onDelete={handleDeleteTrigger}
                  onRename={onRenameTrigger}
                  onMove={handleMoveTrigger}
                  onMoveToWorkspace={(id, wsId) =>
                    handleConfirmMove([id], wsId)
                  }
                  onCopyUrl={handleCopyUrl}
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

        {filteredBookmarks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery
              ? "No bookmarks found"
              : "No bookmarks in this workspace"}
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
              : () => selectAll(filteredBookmarks.map((b) => b.id))
          }
          onDelete={() => handleBulkDeleteTrigger(selectedIds)}
          onMove={() => handleBulkMoveTrigger(selectedIds)}
          onCopyUrls={handleBulkCopyUrls}
        />

        <BookmarkRenameDialog
          open={renameDialogOpen}
          onOpenChange={setRenameDialogOpen}
          bookmark={activeBookmark}
          onSuccess={() => setRenameDialogOpen(false)}
          onConfirm={handleConfirmRename}
          silent
        />

        <BookmarkDeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          ids={bookmarksToDelete}
          onSuccess={() => setDeleteDialogOpen(false)}
          onConfirm={handleConfirmDelete}
          silent
        />

        <BookmarkMoveDialog
          open={moveDialogOpen}
          onOpenChange={setMoveDialogOpen}
          ids={bookmarksToMove}
          workspaces={workspaces}
          currentWorkspaceId={
            bookmarksToMove.length === 1
              ? bookmarks.find((b) => b.id === bookmarksToMove[0])?.workspace_id
              : null
          }
          onSuccess={() => setMoveDialogOpen(false)}
          onConfirm={handleConfirmMove}
          silent
        />
      </section>
    </div>
  );
}
