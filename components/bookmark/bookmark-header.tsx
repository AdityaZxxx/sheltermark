"use client";

import type { RefObject } from "react";
import { BookmarkInput } from "./bookmark-input";
import { BookmarkViewToggle } from "./bookmark-view-toggle";

interface BookmarkHeaderProps {
  inputRef: RefObject<HTMLInputElement | null>;
  view: "list" | "card";
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onViewChange: (view: "list" | "card") => void;
}

export function BookmarkHeader({
  inputRef,
  view,
  searchQuery,
  onSearchChange,
  onSubmit,
  onViewChange,
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
        <BookmarkViewToggle view={view} onViewChange={onViewChange} />
      </div>
    </div>
  );
}
