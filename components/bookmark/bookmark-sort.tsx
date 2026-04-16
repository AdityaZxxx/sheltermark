"use client";

import { ArrowDownIcon, ArrowUpIcon } from "@phosphor-icons/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { BookmarkSort, BookmarkSortBy } from "~/lib/schemas/bookmark";
import { Button } from "../ui/button";

interface BookmarkSortProps {
  sort: BookmarkSort;
  onSortChange: (sort: BookmarkSort) => void;
}

const SORT_OPTIONS: { value: BookmarkSortBy; label: string }[] = [
  { value: "updated_at", label: "Updated" },
  { value: "created_at", label: "Created" },
  { value: "title", label: "Title" },
  { value: "domain", label: "Domain" },
];

export function BookmarkSortSelect({ sort, onSortChange }: BookmarkSortProps) {
  const handleSortByChange = (value: string | null) => {
    if (value) {
      onSortChange({ ...sort, sortBy: value as BookmarkSortBy });
    }
  };

  const toggleSortOrder = () => {
    onSortChange({
      ...sort,
      sortOrder: sort.sortOrder === "asc" ? "desc" : "asc",
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        items={SORT_OPTIONS}
        value={sort.sortBy}
        onValueChange={handleSortByChange}
      >
        <SelectTrigger>
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="secondary"
        onClick={toggleSortOrder}
        aria-label={sort.sortOrder === "asc" ? "Ascending" : "Descending"}
      >
        {sort.sortOrder === "asc" ? (
          <ArrowUpIcon className="size-3.5" />
        ) : (
          <ArrowDownIcon className="size-3.5" />
        )}
      </Button>
    </div>
  );
}
