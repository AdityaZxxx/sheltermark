"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useBookmarkSelection } from "~/hooks/use-bookmark-selection";
import { type Bookmark, useBookmarks } from "~/hooks/use-bookmarks";
import { useWorkspaces } from "~/hooks/use-workspaces";
import { BookmarkCardItem } from "./bookmark-card-item";
import { BookmarkDeleteDialog } from "./bookmark-delete-dialog";
import { BookmarkInput } from "./bookmark-input";
import { BookmarkListItem } from "./bookmark-list-item";
import { BookmarkMoveDialog } from "./bookmark-move-dialog";
import { BookmarkRenameDialog } from "./bookmark-rename-dialog";
import { BookmarkToolbar } from "./bookmark-toolbar";
import { BookmarkViewToggle } from "./bookmark-view-toggle";

export function BookmarkView() {
  const [view, setView] = useState<"list" | "card">("list");
  const inputRef = useRef<HTMLInputElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [activeBookmark, setActiveBookmark] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [bookmarksToDelete, setBookmarksToDelete] = useState<string[]>([]);
  const [bookmarksToMove, setBookmarksToMove] = useState<string[]>([]);

  const { workspaces, currentWorkspace } = useWorkspaces();
  const {
    filteredBookmarks,
    searchQuery,
    setSearchQuery,
    invalidate,
    moveBookmarks,
    addBookmark,
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

  const handleDeleteTrigger = useCallback((id: string) => {
    setBookmarksToDelete([id]);
    setDeleteDialogOpen(true);
  }, []);

  const handleBulkDeleteTrigger = useCallback(() => {
    setBookmarksToDelete(selectedIds);
    setDeleteDialogOpen(true);
  }, [selectedIds]);

  const handleRenameTrigger = useCallback(
    (id: string) => {
      const bookmark = filteredBookmarks.find((b: Bookmark) => b.id === id);
      if (bookmark) {
        setActiveBookmark({ id: bookmark.id, title: bookmark.title || "" });
        setRenameDialogOpen(true);
      }
    },
    [filteredBookmarks],
  );

  const handleMoveTrigger = useCallback((id: string) => {
    setBookmarksToMove([id]);
    setMoveDialogOpen(true);
  }, []);

  const handleMoveToWorkspace = useCallback(
    async (id: string, workspaceId: string) => {
      const res = await moveBookmarks({
        ids: [id],
        targetWorkspaceId: workspaceId,
      });
      if (res.success) {
        invalidate();
      }
    },
    [moveBookmarks, invalidate],
  );

  const handleBulkMoveTrigger = useCallback(() => {
    setBookmarksToMove(selectedIds);
    setMoveDialogOpen(true);
  }, [selectedIds]);

  const handleSubmit = async (val: string) => {
    const trimmed = val.trim();
    if (trimmed.includes(".") || trimmed.startsWith("http")) {
      const formData = new FormData();
      formData.append(
        "url",
        trimmed.startsWith("http") ? trimmed : `https://${trimmed}`,
      );
      if (currentWorkspace?.id) {
        formData.append("workspaceId", currentWorkspace.id);
      }

      setSearchQuery("");
      toast.promise(
        async () => {
          const res = await addBookmark(formData);
          if (res.error) throw new Error(res.error);
          return res;
        },
        {
          loading: "Fetching metadata and saving...",
          success: () => {
            invalidate();
            return "Bookmark added!";
          },
          error: (err) =>
            err instanceof Error ? err.message : "Failed to add bookmark",
        },
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      inputRef.current?.focus();
      setFocusedIndex(-1);
      return;
    }

    if (
      document.activeElement === inputRef.current ||
      document.activeElement?.tagName === "INPUT" ||
      document.activeElement?.tagName === "TEXTAREA"
    ) {
      return;
    }

    const itemCount = filteredBookmarks.length;
    if (itemCount === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < itemCount - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (view === "card") {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev < itemCount - 1 ? prev + 1 : prev));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      }
    }

    if (e.key === "Enter" && focusedIndex >= 0) {
      const bookmark = filteredBookmarks[focusedIndex];
      if (bookmark) {
        window.open(bookmark.url, "_blank");
      }
    }
  };

  return (
    <section
      aria-label="Bookmarks"
      className="max-w-2xl mx-auto py-8 px-4 md:px-6 space-y-6 relative outline-none"
      onKeyDown={handleKeyDown}
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
        {filteredBookmarks.map((bookmark: Bookmark, index: number) =>
          view === "card" ? (
            <div key={bookmark.id} id={`bookmark-${bookmark.id}`}>
              <BookmarkCardItem
                id={bookmark.id}
                title={bookmark.title || ""}
                url={bookmark.url}
                og_image_url={bookmark.og_image_url || undefined}
                favicon_url={bookmark.favicon_url || undefined}
                domain={bookmark.domain || new URL(bookmark.url).hostname}
                created_at={bookmark.created_at}
                isSelected={
                  selectedIds.includes(bookmark.id) ||
                  (!isSelectionMode && focusedIndex === index)
                }
                isSelectionMode={isSelectionMode}
                workspaces={workspaces}
                currentWorkspaceId={currentWorkspace?.id}
                onSelect={toggleSelect}
                onDelete={handleDeleteTrigger}
                onRename={handleRenameTrigger}
                onMove={handleMoveTrigger}
                onMoveToWorkspace={handleMoveToWorkspace}
                onCopyUrl={handleCopyUrl}
                onSelectionModeToggle={toggleSelectionMode}
                tabIndex={
                  focusedIndex === index || (focusedIndex === -1 && index === 0)
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
                domain={bookmark.domain || new URL(bookmark.url).hostname}
                created_at={bookmark.created_at}
                isSelected={
                  selectedIds.includes(bookmark.id) ||
                  (!isSelectionMode && focusedIndex === index)
                }
                isSelectionMode={isSelectionMode}
                workspaces={workspaces}
                currentWorkspaceId={currentWorkspace?.id}
                onSelect={toggleSelect}
                onDelete={handleDeleteTrigger}
                onRename={handleRenameTrigger}
                onMove={handleMoveTrigger}
                onMoveToWorkspace={handleMoveToWorkspace}
                onCopyUrl={handleCopyUrl}
                onSelectionModeToggle={toggleSelectionMode}
                tabIndex={
                  focusedIndex === index || (focusedIndex === -1 && index === 0)
                    ? 0
                    : -1
                }
              />
            </div>
          ),
        )}
      </div>

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
            : () => selectAll(filteredBookmarks.map((b: Bookmark) => b.id))
        }
        onDelete={handleBulkDeleteTrigger}
        onMove={handleBulkMoveTrigger}
        onCopyUrls={handleBulkCopyUrls}
      />

      {/* Dialogs */}
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
          if (bookmarksToDelete.length > 1) clearSelection();
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
          if (bookmarksToMove.length > 1) clearSelection();
        }}
      />
    </section>
  );
}
