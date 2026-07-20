"use client";

import { BookmarkIcon } from "@phosphor-icons/react";
import type { Bookmark } from "~/lib/schemas/bookmark.schema";
import type { BookmarkViewVariant } from "~/lib/schemas/common";
import type { Tag } from "~/lib/schemas/tag.schema";
import type { Workspace } from "~/lib/schemas/workspace.schema";
import { safeDomain } from "~/lib/utils";
import { BookmarkCardItem } from "./bookmark-card-item";
import { BookmarkCardItemLoading } from "./bookmark-card-item-loading";
import { BookmarkComfortItem } from "./bookmark-comfort-item";
import { BookmarkComfortItemLoading } from "./bookmark-comfort-item-loading";
import { BookmarkListItem } from "./bookmark-list-item";
import { BookmarkListItemLoading } from "./bookmark-list-item-loading";
import { BookmarkSkeleton } from "./bookmark-skeleton";

interface PendingBookmark {
  id: string;
  url: string;
}

interface BookmarkListProps {
  view: BookmarkViewVariant;
  isLoading: boolean;
  searchQuery: string;
  filteredBookmarks: Bookmark[];
  pendingUrls: PendingBookmark[];
  workspaces: Workspace[];
  currentWorkspaceId?: string;
  selectedIds: string[];
  isSelectionMode: boolean;
  focusedIndex: number;
  onSelect: (id: string) => void;
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
}

export function BookmarkList({
  view,
  isLoading,
  searchQuery,
  filteredBookmarks,
  pendingUrls,
  workspaces,
  currentWorkspaceId,
  selectedIds,
  isSelectionMode,
  focusedIndex,
  onSelect,
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
}: BookmarkListProps) {
  const isEmpty = filteredBookmarks.length === 0 && pendingUrls.length === 0;

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

  return (
    <div
      className={
        view === "card"
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          : "flex flex-col gap-1"
      }
    >
      {pendingUrls.map((pending) =>
        view === "card" ? (
          <BookmarkCardItemLoading key={pending.id} url={pending.url} />
        ) : view === "comfort" ? (
          <BookmarkComfortItemLoading key={pending.id} url={pending.url} />
        ) : (
          <BookmarkListItemLoading key={pending.id} url={pending.url} />
        ),
      )}
      {filteredBookmarks.map((bookmark, index) => {
        const isSelected =
          selectedIds.includes(bookmark.id) ||
          (!isSelectionMode && focusedIndex === index);

        const tabIndex =
          focusedIndex === index || (focusedIndex === -1 && index === 0)
            ? 0
            : -1;

        const bookmarkTagIds = tagsByBookmarkId.get(bookmark.id) ?? [];
        const bookmarkTags = bookmarkTagIds
          .map((tagId) => allTags.find((t) => t.id === tagId))
          .filter((t): t is Tag => t !== undefined);

        const commonProps = {
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
          bookmarkWorkspaceId: bookmark.workspace_id,
          workspaces,
          currentWorkspaceId,
          onSelect,
          onDelete,
          onEdit,
          onTagClick,
          onMove,
          onMoveToWorkspace,
          onCopyUrl,
          onRefetch,
          onSelectionModeToggle,
          tabIndex,
        };

        if (view === "card") {
          return <BookmarkCardItem key={bookmark.id} {...commonProps} />;
        }
        if (view === "comfort") {
          return <BookmarkComfortItem key={bookmark.id} {...commonProps} />;
        }
        return <BookmarkListItem key={bookmark.id} {...commonProps} />;
      })}
    </div>
  );
}
