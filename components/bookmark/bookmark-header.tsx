"use client";

import type { RefObject } from "react";
import type { BookmarkSort } from "../../lib/schemas/bookmark.schema";
import { BookmarkInput } from "./bookmark-input";
import { BookmarkSortSelect } from "./bookmark-sort";
import { BookmarkTagFilter } from "./bookmark-tag-filter";
import { BookmarkViewToggle } from "./bookmark-view-toggle";

interface BookmarkHeaderProps {
  inputRef: RefObject<HTMLInputElement | null>;
  view: "list" | "card";
  searchQuery: string;
  sort: BookmarkSort;
  selectedTagIds: string[];
  onSearchChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onViewChange: (view: "list" | "card") => void;
  onSortChange: (sort: BookmarkSort) => void;
  onTagFilterChange: (tagIds: string[]) => void;
}

export function BookmarkHeader({
  inputRef,
  view,
  searchQuery,
  sort,
  selectedTagIds,
  onSearchChange,
  onSubmit,
  onViewChange,
  onSortChange,
  onTagFilterChange,
}: BookmarkHeaderProps) {
  return (
    <div className="space-y-3 mx-auto">
      <BookmarkInput
        ref={inputRef}
        value={searchQuery}
        onChange={onSearchChange}
        onSubmit={onSubmit}
      />

      <BookmarkTagFilter
        selectedTagIds={selectedTagIds}
        onChange={onTagFilterChange}
      />

      <div className="flex items-center justify-between pt-2">
        <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          {searchQuery ? "Search Results" : "All Bookmarks"}
        </h2>
        <div className="flex items-center gap-2">
          <BookmarkSortSelect sort={sort} onSortChange={onSortChange} />
          <BookmarkViewToggle view={view} onViewChange={onViewChange} />
        </div>
      </div>
    </div>
  );
}
