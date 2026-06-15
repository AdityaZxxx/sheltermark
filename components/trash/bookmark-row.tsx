"use client";

import {
  ArrowCounterClockwiseIcon,
  ClockAfternoonIcon,
  GlobeIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { ProgressiveImage } from "~/components/progressive-image";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { formatRelativeTime } from "~/lib/format";
import type { Bookmark } from "~/lib/schemas/bookmark.schema";
import { cn, safeDomain } from "~/lib/utils";

export function BookmarkRow({
  bookmark,
  isSelected,
  onSelect,
  onRestore,
  onPermanentDelete,
  compact,
}: {
  bookmark: Bookmark;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  compact?: boolean;
}) {
  const domain = safeDomain(bookmark.url);

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-border last:border-0 transition-colors",
        isSelected && "bg-muted/30",
        compact ? "px-4 py-2" : "px-4 py-2.5",
      )}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onSelect(bookmark.id)}
      />
      <div className="size-6 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
        {bookmark.favicon_url ? (
          <ProgressiveImage
            src={bookmark.favicon_url}
            alt=""
            className="size-4"
          />
        ) : (
          <GlobeIcon className="size-3.5 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "font-medium truncate",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {bookmark.title || "Untitled"}
        </p>
        <p
          className={cn(
            "text-muted-foreground truncate",
            compact ? "text-[11px]" : "text-xs",
          )}
        >
          {domain}
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
        <ClockAfternoonIcon className="size-3" />
        <span>
          {bookmark.deleted_at
            ? formatRelativeTime(bookmark.deleted_at)
            : "recently"}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            onRestore(bookmark.id);
          }}
          title="Restore"
        >
          <ArrowCounterClockwiseIcon className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            onPermanentDelete(bookmark.id);
          }}
          className="text-destructive hover:text-destructive"
          title="Delete forever"
        >
          <TrashIcon className="size-3" />
        </Button>
      </div>
    </div>
  );
}
