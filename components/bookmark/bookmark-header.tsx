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
  title?: string;
  workspaceId?: string;
  aiSearchTerms?: string[] | null;
  onAskAi?: () => void;
  isAskingAi?: boolean;
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
  title = "All Bookmarks",
  workspaceId,
  aiSearchTerms,
  onAskAi,
  isAskingAi,
  onSearchChange,
  onSubmit,
  onViewChange,
  onSortChange,
  onTagFilterChange,
  onManageTags,
}: BookmarkHeaderProps) {
  return (
    <div className="space-y-3 mx-auto sm:space-y-4">
      <BookmarkInput
        ref={inputRef}
        value={searchQuery}
        onChange={onSearchChange}
        onSubmit={onSubmit}
        onAskAi={onAskAi}
        isAskingAi={isAskingAi}
      />

      {aiSearchTerms && aiSearchTerms.length > 0 && (
        <output className="flex items-center gap-1.5 text-xs text-muted-foreground">
          AI search for:
          <span className="font-medium text-foreground">
            {aiSearchTerms.join(" ")}
          </span>
        </output>
      )}

      <BookmarkTagFilter
        selectedTagIds={selectedTagIds}
        onChange={onTagFilterChange}
        onManageTags={onManageTags}
        workspaceId={workspaceId}
      />

      <div className="flex items-center justify-between gap-2 pt-1 sm:pt-2">
        <h2 className="text-xs font-medium text-muted-foreground uppercase text-balance tracking-wider">
          {searchQuery ? "Search Results" : title}
          {count !== undefined && count > 0 && (
            <span className="ml-1.5 tabular-nums text-muted-foreground">
              · <span>{count}</span>
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
