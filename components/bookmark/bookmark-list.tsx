"use client";

import { BookmarkIcon } from "@phosphor-icons/react";
import {
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";

import type { Bookmark } from "~/lib/schemas/bookmark.schema";
import type { BookmarkViewVariant } from "~/lib/schemas/common";
import type { Tag } from "~/lib/schemas/tag.schema";
import type { WorkspaceWithCount } from "~/lib/schemas/workspace.schema";

import { ContextMenu, ContextMenuTrigger } from "~/components/ui/context-menu";
import { useExitAnimation } from "~/hooks/use-exit-animation";
import { safeDomain } from "~/lib/utils";

import { BookmarkCardItem } from "./bookmark-card-item";
import { BookmarkComfortItem } from "./bookmark-comfort-item";
import { BookmarkContextMenu } from "./bookmark-context-menu";
import { BookmarkListItem } from "./bookmark-list-item";
import { BookmarkSkeleton } from "./bookmark-skeleton";
import { VirtualList } from "./virtual-list";

interface BookmarkListProps {
  view: BookmarkViewVariant;
  isLoading: boolean;
  searchQuery: string;
  filteredBookmarks: Bookmark[];
  selectedIds: string[];
  isSelectionMode: boolean;
  focusedIndex: number;
  onSelect: (id: string) => void;
  onOpen?: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onTagClick: (tagId: string) => void;
  onMove: (id: string) => void;
  onMoveToWorkspace: (id: string, workspaceId: string) => void;
  onCopyUrl: (url: string) => void;
  onRefetch: (id: string) => void;
  onSelectionModeToggle: () => void;
  autoCheckBroken?: boolean;
  tagsByBookmarkId: Map<string, string[]>;
  allTags: Tag[];
  refetchingId?: string | null;
  filterKey?: string;
  currentWorkspaceId: string | null;
  workspaceNameById: Map<string, string>;
  availableWorkspaces: WorkspaceWithCount[];
  scrollRef: RefObject<HTMLDivElement | null>;
}

export function BookmarkList({
  view,
  isLoading,
  searchQuery,
  filteredBookmarks,
  selectedIds,
  isSelectionMode,
  focusedIndex,
  onSelect,
  onOpen,
  onDelete,
  onEdit,
  onTagClick,
  onMove,
  onMoveToWorkspace,
  onCopyUrl,
  onRefetch,
  onSelectionModeToggle,
  autoCheckBroken = true,
  tagsByBookmarkId,
  allTags,
  refetchingId,
  filterKey,
  currentWorkspaceId,
  workspaceNameById,
  availableWorkspaces,
  scrollRef,
}: BookmarkListProps) {
  const { exiting } = useExitAnimation(filteredBookmarks, 150, filterKey);
  const [activeBookmark, setActiveBookmark] = useState<Bookmark | null>(null);
  const tagsById = new Map(allTags.map((tag) => [tag.id, tag] as const));
  const isEmpty = filteredBookmarks.length === 0 && exiting.length === 0;

  if (isLoading) {
    return <BookmarkSkeleton count={6} view={view} />;
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 flex items-center justify-center mb-4">
          <BookmarkIcon className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-medium text-muted-foreground mb-1">
          {searchQuery ? "No results found" : "No bookmarks yet"}
        </h3>
      </div>
    );
  }

  function getCommonProps(bookmark: Bookmark, index: number) {
    const isSelected =
      selectedIds.includes(bookmark.id) ||
      (!isSelectionMode && focusedIndex === index);

    const tabIndex =
      focusedIndex === index || (focusedIndex === -1 && index === 0) ? 0 : -1;

    const bookmarkTagIds = tagsByBookmarkId.get(bookmark.id) ?? [];
    const bookmarkTags = bookmarkTagIds
      .map((tagId) => tagsById.get(tagId))
      .filter((t): t is Tag => t !== undefined);
    const workspaceName =
      !currentWorkspaceId && bookmark.workspace_id
        ? (workspaceNameById.get(bookmark.workspace_id) ?? null)
        : null;

    return {
      id: bookmark.id,
      title: bookmark.title || "",
      url: bookmark.url,
      note: bookmark.note,
      tags: bookmarkTags,
      og_image_url: bookmark.og_image_url || undefined,
      favicon_url: bookmark.favicon_url || undefined,
      domain: safeDomain(bookmark.url),
      created_at: bookmark.created_at,
      httpStatus: bookmark.http_status,
      brokenStatus: bookmark.broken_status,
      autoCheckBroken,
      isSelected,
      isSelectionMode,
      workspaceName,
      onSelect,
      onOpen,
      onTagClick,
      tabIndex,
      refetchingId,
    };
  }

  function handleContextMenuCapture(event: MouseEvent<HTMLDivElement>) {
    const row =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>("[data-bookmark-id]")
        : null;
    const bookmarkId = row?.getAttribute("data-bookmark-id");
    const bookmark =
      filteredBookmarks.find((item) => item.id === bookmarkId) ?? null;

    if (!bookmark) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    setActiveBookmark(bookmark);
  }

  const contextMenu = (
    <BookmarkContextMenu
      activeBookmark={activeBookmark}
      availableWorkspaces={availableWorkspaces}
      isSelectionMode={isSelectionMode}
      onSelect={onSelect}
      onEdit={onEdit}
      onMove={onMove}
      onMoveToWorkspace={onMoveToWorkspace}
      onCopyUrl={onCopyUrl}
      onDelete={onDelete}
      onRefetch={onRefetch}
      onSelectionModeToggle={onSelectionModeToggle}
    />
  );

  const exitClass =
    "animate-out fade-out slide-out-to-top-2 duration-150 ease-out";

  const withContextMenu = (
    className: string | undefined,
    children: ReactNode,
  ) => (
    <ContextMenu>
      <ContextMenuTrigger
        render={(props) => (
          <div
            {...props}
            className={className}
            onContextMenuCapture={handleContextMenuCapture}
          >
            {children}
          </div>
        )}
      />
      {contextMenu}
    </ContextMenu>
  );

  if (view === "list" || view === "comfort") {
    const IsList = view === "list";
    return withContextMenu(
      undefined,
      <>
        {exiting.length > 0 && (
          <div className="flex flex-col gap-1 mb-1">
            {exiting.map((bookmark) => {
              const stableKey = bookmark.id;
              return IsList ? (
                <div key={stableKey} className={exitClass}>
                  <BookmarkListItem {...getCommonProps(bookmark, 0)} />
                </div>
              ) : (
                <div key={stableKey} className={exitClass}>
                  <BookmarkComfortItem {...getCommonProps(bookmark, 0)} />
                </div>
              );
            })}
          </div>
        )}
        {/* key forces a fresh virtualizer per view — stale measurements from
            the previous view's row heights paint one misaligned frame */}
        <VirtualList
          key={view}
          scrollRef={scrollRef}
          items={filteredBookmarks}
          estimateSize={IsList ? 38 : 100}
          gap={4}
          renderItem={(bookmark, index) =>
            IsList ? (
              <BookmarkListItem {...getCommonProps(bookmark, index)} />
            ) : (
              <BookmarkComfortItem {...getCommonProps(bookmark, index)} />
            )
          }
        />
      </>,
    );
  }

  return withContextMenu(
    "grid grid-cols-2 md:grid-cols-3 gap-4",
    <>
      {exiting.map((bookmark) => {
        const stableKey = bookmark.id;
        return (
          <div key={stableKey} className={exitClass}>
            <BookmarkCardItem {...getCommonProps(bookmark, 0)} />
          </div>
        );
      })}
      {filteredBookmarks.map((bookmark, index) => {
        const common = getCommonProps(bookmark, index);
        const stableKey = bookmark.id;
        return (
          <div key={stableKey} style={{ contentVisibility: "auto" }}>
            <BookmarkCardItem {...common} />
          </div>
        );
      })}
    </>,
  );
}
