"use client";

import {
  ArrowCounterClockwiseIcon,
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
        "flex items-center gap-2.5 sm:gap-3 border-b border-border last:border-0 transition-colors",
        isSelected && "bg-muted/30",
        compact ? "px-3 sm:px-4 py-2" : "px-3 sm:px-4 py-2.5 sm:py-3",
      )}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onSelect(bookmark.id)}
        className="shrink-0"
      />
      <div className="size-7 sm:size-8 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
        {bookmark.favicon_url ? (
          <ProgressiveImage
            src={bookmark.favicon_url}
            alt=""
            className="size-4 sm:size-5"
          />
        ) : (
          <GlobeIcon className="size-4 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "font-medium truncate leading-snug",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {bookmark.title || "Untitled"}
        </p>
        <p
          className={cn(
            "text-muted-foreground truncate flex items-center gap-1.5",
            compact ? "text-[11px]" : "text-xs",
          )}
        >
          <span>{domain}</span>
          <span className="text-muted-foreground/40" aria-hidden="true">
            ·
          </span>
          <span className="shrink-0" suppressHydrationWarning>
            {bookmark.deleted_at
              ? formatRelativeTime(bookmark.deleted_at)
              : "recently"}
          </span>
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {compact ? (
          <>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                onRestore(bookmark.id);
              }}
              title="Restore"
            >
              <ArrowCounterClockwiseIcon className="size-2.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                onPermanentDelete(bookmark.id);
              }}
              className="text-destructive hover:text-destructive"
              title="Delete forever"
            >
              <TrashIcon className="size-2.5" />
            </Button>
          </>
        ) : (
          <>
            <div className="flex sm:hidden items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
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
                size="icon-sm"
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
            <div className="hidden sm:flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore(bookmark.id);
                }}
              >
                <ArrowCounterClockwiseIcon className="size-3 sm:mr-1.5" />
                <span className="hidden sm:inline">Restore</span>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
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
          </>
        )}
      </div>
    </div>
  );
}
