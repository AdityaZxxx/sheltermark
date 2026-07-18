"use client";

import type { RefObject } from "react";
import type { BookmarkSort } from "../../lib/schemas/bookmark";
import { BookmarkInput } from "./bookmark-input";
import { BookmarkSortSelect } from "./bookmark-sort";
import { BookmarkViewToggle } from "./bookmark-view-toggle";

interface BookmarkHeaderProps {
  inputRef: RefObject<HTMLInputElement | null>;
  view: "list" | "card";
  searchQuery: string;
  sort: BookmarkSort;
  onSearchChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onViewChange: (view: "list" | "card") => void;
  onSortChange: (sort: BookmarkSort) => void;
}

export function BookmarkHeader({
  inputRef,
  view,
  searchQuery,
  sort,
  onSearchChange,
  onSubmit,
  onViewChange,
  onSortChange,
}: BookmarkHeaderProps) {
  return (
    <div className="space-y-4 mx-auto">
      <BookmarkInput
        ref={inputRef}
        value={searchQuery}
        onChange={onSearchChange}
        onSubmit={onSubmit}
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
