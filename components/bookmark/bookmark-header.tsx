"use client";

import type { RefObject } from "react";
import type { BookmarkViewVariant } from "~/lib/schemas/common";
import type { BookmarkSort } from "../../lib/schemas/bookmark.schema";
import { BookmarkInput } from "./bookmark-input";
import { BookmarkMobileControls } from "./bookmark-mobile-controls";
import { BookmarkSortSelect } from "./bookmark-sort";
import { BookmarkTagFilter } from "./bookmark-tag-filter";
import { BookmarkViewToggle } from "./bookmark-view-toggle";

interface BookmarkHeaderProps {
  inputRef: RefObject<HTMLInputElement | null>;
  view: BookmarkViewVariant;
  searchQuery: string;
  sort: BookmarkSort;
  selectedTagIds: string[];
  count?: number;
  workspaceId?: string;
  onSearchChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onViewChange: (view: BookmarkViewVariant) => void;
  onSortChange: (sort: BookmarkSort) => void;
  onTagFilterChange: (tagIds: string[]) => void;
  onManageTags?: () => void;
}

export function BookmarkHeader({
  inputRef,
  view,
  searchQuery,
  sort,
  selectedTagIds,
  count,
  workspaceId,
  onSearchChange,
  onSubmit,
  onViewChange,
  onSortChange,
  onTagFilterChange,
  onManageTags,
}: BookmarkHeaderProps) {
  return (
    <div className="space-y-2 mx-auto sm:space-y-3">
      <BookmarkInput
        ref={inputRef}
        value={searchQuery}
        onChange={onSearchChange}
        onSubmit={onSubmit}
      />

      <BookmarkTagFilter
        selectedTagIds={selectedTagIds}
        onChange={onTagFilterChange}
        onManageTags={onManageTags}
        workspaceId={workspaceId}
      />

      <div className="flex items-center justify-between gap-2 pt-1 sm:pt-2">
        <h2 className="text-xs font-medium text-muted-foreground uppercase text-balance">
          {searchQuery ? "Search Results" : "All Bookmarks"}
          {typeof count === "number" && count > 0 && (
            <span className="ml-1.5 tabular-nums text-foreground/40">
              · <span className="text-foreground/60">{count}</span>
            </span>
          )}
        </h2>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <BookmarkSortSelect sort={sort} onSortChange={onSortChange} />
            <BookmarkViewToggle view={view} onViewChange={onViewChange} />
          </div>
          <div className="sm:hidden">
            <BookmarkMobileControls
              sort={sort}
              view={view}
              onSortChange={onSortChange}
              onViewChange={onViewChange}
              onManageTags={onManageTags}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
