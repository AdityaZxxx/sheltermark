"use client";

import { useRef, useState } from "react";

import type { BookmarkViewVariant } from "~/lib/schemas/common";
import type { Workspace } from "~/lib/schemas/workspace.schema";

import { BookmarkCardItem } from "~/components/bookmark/bookmark-card-item";
import { BookmarkComfortItem } from "~/components/bookmark/bookmark-comfort-item";
import { BookmarkEditDialog } from "~/components/bookmark/bookmark-edit-dialog";
import { BookmarkInput } from "~/components/bookmark/bookmark-input";
import { BookmarkListItem } from "~/components/bookmark/bookmark-list-item";
import { BookmarkMoveDialog } from "~/components/bookmark/bookmark-move-dialog";
import { BookmarkToolbar } from "~/components/bookmark/bookmark-toolbar";
import { BookmarkTrash } from "~/components/bookmark/bookmark-trash";
import { BookmarkViewToggle } from "~/components/bookmark/bookmark-view-toggle";
import { useBookmarkDialogs } from "~/hooks/use-bookmark-dialogs";
import { useBookmarkKeyboardNavigation } from "~/hooks/use-bookmark-keyboard";
import { useBookmarkSelection } from "~/hooks/use-bookmark-selection";
import { safeDomain } from "~/lib/utils";

import {
  DEMO_TAGS,
  DEMO_WORKSPACES,
  type DemoBookmark,
  getBookmarkTags,
  INITIAL_DEMO_BOOKMARKS,
} from "./demo-data";
import { DemoHeader } from "./demo-header";

type WorkspaceDemo = Pick<
  Workspace,
  "id" | "name" | "is_public" | "is_default"
>;

function copyUrlToClipboard(url: string) {
  navigator.clipboard.writeText(url);
}

export function DemoBookmarkView() {
  const [bookmarks, setBookmarks] = useState<DemoBookmark[]>(
    INITIAL_DEMO_BOOKMARKS,
  );
  const [workspaces] = useState<WorkspaceDemo[]>(DEMO_WORKSPACES);
  const [activeWorkspaceId, setActiveWorkspaceId] =
    useState<string>("personal");
  const [view, setView] = useState<BookmarkViewVariant>("list");
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
    editDialogOpen,
    setEditDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    moveDialogOpen,
    setMoveDialogOpen,
    activeBookmark,
    bookmarksToDelete,
    bookmarksToMove,
    handleDeleteTrigger,
    handleBulkDeleteTrigger,
    handleEditTrigger,
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

  const { focusedIndex, inputRef, handleKeyDown } =
    useBookmarkKeyboardNavigation({
      itemCount: filteredBookmarks.length,
      view,
      onSelect: toggleSelect,
      onOpen: (url) => window.open(url, "_blank", "noopener,noreferrer"),
      isSelectionMode,
    });

  const handleBulkCopyUrls = () => {
    const urls = filteredBookmarks
      .filter((b) => selectedIds.includes(b.id))
      .map((b) => b.url)
      .join("\n");
    navigator.clipboard.writeText(urls);
  };

  const handleRefetchTrigger = async (id: string) => {
    const bookmark = bookmarks.find((b) => b.id === id);
    if (!bookmark) return;

    try {
      const res = await fetch("/api/demo/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: bookmark.url }),
      });
      const metadata = await res.json();

      setBookmarks((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                favicon_url: metadata.favicon_url || null,
                og_image_url: metadata.og_image_url || null,
              }
            : b,
        ),
      );
    } catch {
      // silently fail in demo
    }
  };

  const lastDeletedRef = useRef<{ ids: string[]; items: typeof bookmarks }>({
    ids: [],
    items: [],
  });

  const handleConfirmDelete = (ids: string[]) => {
    setBookmarks((prev) => {
      lastDeletedRef.current = {
        ids,
        items: prev.filter((b) => ids.includes(b.id)),
      };
      return prev.filter((b) => !ids.includes(b.id));
    });
    if (ids.length > 1) {
      clearSelection();
    }
  };

  const handleUndoDelete = (ids: string[]) => {
    const items = lastDeletedRef.current.items;
    setBookmarks((prev) => [
      ...items.filter((b) => ids.includes(b.id)),
      ...prev,
    ]);
  };

  const handleConfirmMove = (ids: string[], targetWorkspaceId: string) => {
    setBookmarks((prev) =>
      prev.map((b) =>
        ids.includes(b.id) ? { ...b, workspace_id: targetWorkspaceId } : b,
      ),
    );
    if (ids.length > 1) {
      clearSelection();
    }
  };

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

      const newBookmark: DemoBookmark = {
        id: crypto.randomUUID(),
        title: metadata.title || url,
        url,
        favicon_url: metadata.favicon_url || null,
        og_image_url: metadata.og_image_url || null,
        workspace_id: activeWorkspaceId || "personal",
        created_at: new Date().toISOString(),
        note: null,
        is_broken: false,
        broken_status: "alive" as const,
        http_status: null,
        last_checked_at: null,
      };

      setBookmarks((prev) => [newBookmark, ...prev]);
      setSearchQuery("");
    } catch {
      const newBookmark: DemoBookmark = {
        id: crypto.randomUUID(),
        title: url,
        url,
        favicon_url: null,
        og_image_url: null,
        workspace_id: activeWorkspaceId || "personal",
        created_at: new Date().toISOString(),
        note: null,
        is_broken: false,
        broken_status: "alive" as const,
        http_status: null,
        last_checked_at: null,
      };

      setBookmarks((prev) => [newBookmark, ...prev]);
      setSearchQuery("");
    }
  };

  const onEditTrigger = (id: string) => {
    const bookmark = filteredBookmarks.find((b) => b.id === id);
    if (bookmark) {
      handleEditTrigger(id, [
        {
          id: bookmark.id,
          title: bookmark.title,
          note: bookmark.note,
          tagsByBookmarkId: new Map(
            filteredBookmarks.map((b) => [
              b.id,
              getBookmarkTags(b.id).map((t) => t.id),
            ]),
          ),
          allTags: DEMO_TAGS,
        },
      ]);
    }
  };

  const getItem = (index: number) => {
    const bookmark = filteredBookmarks[index];
    if (bookmark) {
      return { id: bookmark.id, url: bookmark.url };
    }
    return undefined;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    handleKeyDown(e, getItem);
  };

  return (
    <div className="h-full bg-background max-w-4xl mx-auto rounded-lg border">
      <DemoHeader
        workspaces={workspaces}
        currentWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={setActiveWorkspaceId}
      />

      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- container-level keyboard shortcut dispatch for bookmark list navigation; no interactive semantics needed */}
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
            <BookmarkViewToggle
              view={view}
              onViewChange={setView}
              showLabels={false}
            />
          </div>
        </div>

        <div
          className={
            view === "card"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "flex flex-col gap-1 max-w-2xl mx-auto"
          }
        >
          {filteredBookmarks.map((bookmark, index) => {
            const tags = getBookmarkTags(bookmark.id);
            const commonProps = {
              id: bookmark.id,
              title: bookmark.title || "",
              url: bookmark.url,
              og_image_url: bookmark.og_image_url || undefined,
              favicon_url: bookmark.favicon_url || undefined,
              domain: safeDomain(bookmark.url),
              created_at: bookmark.created_at,
              note: bookmark.note,
              tags,
              brokenStatus: bookmark.broken_status,
              httpStatus: bookmark.http_status,
              autoCheckBroken: true,
              isSelected:
                selectedIds.includes(bookmark.id) ||
                (!isSelectionMode && focusedIndex === index),
              isSelectionMode,
              workspaces,
              currentWorkspaceId: bookmark.workspace_id ?? undefined,
              onSelect: toggleSelect,
              onDelete: handleDeleteTrigger,
              onEdit: onEditTrigger,
              onMove: handleMoveTrigger,
              onMoveToWorkspace: (id: string, wsId: string) =>
                handleConfirmMove([id], wsId),
              onCopyUrl: copyUrlToClipboard,
              onRefetch: handleRefetchTrigger,
              onSelectionModeToggle: toggleSelectionMode,
              tabIndex:
                focusedIndex === index || (focusedIndex === -1 && index === 0)
                  ? 0
                  : -1,
            };

            return (
              <div key={bookmark.id} id={`bookmark-${bookmark.id}`}>
                {view === "card" ? (
                  <BookmarkCardItem {...commonProps} />
                ) : view === "comfort" ? (
                  <BookmarkComfortItem {...commonProps} />
                ) : (
                  <BookmarkListItem {...commonProps} />
                )}
              </div>
            );
          })}
        </div>

        {filteredBookmarks.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
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

        <BookmarkEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          bookmark={
            activeBookmark
              ? {
                  id: activeBookmark.id,
                  title: activeBookmark.title,
                  note: activeBookmark.note,
                  tags: activeBookmark.tags,
                }
              : null
          }
          allTags={DEMO_TAGS.map((t) => ({ ...t, count: 0 }))}
          updateBookmarkFields={() => {
            // Demo: no-op mock
            setEditDialogOpen(false);
          }}
          isPending={false}
        />

        <BookmarkTrash
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          ids={bookmarksToDelete}
          onConfirm={handleConfirmDelete}
          onUndo={handleUndoDelete}
        />

        <BookmarkMoveDialog
          open={moveDialogOpen}
          onOpenChange={setMoveDialogOpen}
          ids={bookmarksToMove}
          workspaces={workspaces}
          currentWorkspaceId={
            bookmarksToMove.length === 1
              ? (bookmarks.find((b) => b.id === bookmarksToMove[0])
                  ?.workspace_id ?? undefined)
              : undefined
          }
          onSuccess={() => setMoveDialogOpen(false)}
          onConfirm={handleConfirmMove}
        />
      </section>
    </div>
  );
}
