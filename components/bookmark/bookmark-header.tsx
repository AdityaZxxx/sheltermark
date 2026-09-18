"use client";

import type { RefObject } from "react";

import type { BookmarkViewVariant } from "~/lib/schemas/common";
import type { TagWithCount } from "~/lib/schemas/tag.schema";

import { isUrlLike } from "~/lib/utils";

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
  filterTags: TagWithCount[];
  count?: number;
  title?: string;
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
  filterTags,
  count,
  title = "All Bookmarks",
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
  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = inputRef.current?.value.trim() ?? "";
    if (!value) return;
    onSubmit(value);
    if (isUrlLike(value)) {
      onSearchChange("");
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <form onSubmit={handleSubmit} className="contents">
        <BookmarkInput
          ref={inputRef}
          value={searchQuery}
          onChange={onSearchChange}
          onAskAi={onAskAi}
          isAskingAi={isAskingAi}
        />
      </form>

      {aiSearchTerms && aiSearchTerms.length > 0 && (
        <output className="flex items-center gap-1.5 text-xs text-muted-foreground">
          AI search for:
          <span className="font-medium text-foreground">
            {aiSearchTerms.join(" ")}
          </span>
        </output>
      )}

      <div className="flex min-h-8 items-center justify-between gap-2">
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

      <BookmarkTagFilter
        tags={filterTags}
        selectedTagIds={selectedTagIds}
        onChange={onTagFilterChange}
        onManageTags={onManageTags}
      />
    </div>
  );
}
