"use client";

import {
  ArrowBendUpLeftIcon,
  GlobeIcon,
  SelectionPlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { ProgressiveImage } from "~/components/progressive-image";
import { Checkbox } from "~/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";
import { formatRelativeTime } from "~/lib/format";
import type { Bookmark } from "~/lib/schemas/bookmark.schema";
import { cn, safeDomain } from "~/lib/utils";

export function BookmarkRow({
  bookmark,
  isSelected,
  onSelect,
  onRestore,
  onPermanentDelete,
  showCheckbox,
  onSelectionModeToggle,
}: {
  bookmark: Bookmark;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  showCheckbox?: boolean;
  onSelectionModeToggle?: () => void;
}) {
  const domain = safeDomain(bookmark.url);

  const rowContent = (
    // biome-ignore lint/a11y/useSemanticElements: must be <div> to avoid <button> inside <button> hydration error; inner action buttons need a non-button parent
    <div
      role="button"
      tabIndex={showCheckbox ? 0 : -1}
      className={cn(
        "flex w-full items-center gap-2.5 border-b border-border px-3 py-2.5 text-left transition-colors last:border-0 sm:gap-3 sm:px-4 sm:py-3",
        isSelected && "bg-muted/30",
        showCheckbox && "cursor-pointer",
      )}
      onClick={() => {
        if (showCheckbox) {
          onSelect(bookmark.id);
        } else {
          window.open(bookmark.url, "_blank");
        }
      }}
      onKeyDown={(e) => {
        if (showCheckbox && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect(bookmark.id);
        }
      }}
    >
      {showCheckbox && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect(bookmark.id)}
          className="shrink-0"
        />
      )}
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
        <p className="truncate text-sm font-medium leading-snug">
          {bookmark.title || "Untitled"}
        </p>
        <p className="flex items-center justify-between truncate text-xs text-muted-foreground">
          <span>{domain}</span>
          <span className="shrink-0" suppressHydrationWarning>
            {bookmark.deleted_at
              ? formatRelativeTime(bookmark.deleted_at)
              : "recently"}
          </span>
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:w-auto sm:px-2"
          onClick={(e) => {
            e.stopPropagation();
            onRestore(bookmark.id);
          }}
          title="Restore"
        >
          <ArrowBendUpLeftIcon className="size-4" />
        </button>
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
          onClick={(e) => {
            e.stopPropagation();
            onPermanentDelete(bookmark.id);
          }}
          title="Delete forever"
        >
          <TrashIcon className="size-4" />
        </button>
      </div>
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={(props) => <div {...props}>{rowContent}</div>}
      />
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => {
            if (!showCheckbox) {
              onSelect(bookmark.id);
              onSelectionModeToggle?.();
            }
          }}
        >
          <SelectionPlusIcon />
          Select Multiple
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onRestore(bookmark.id)}>
          <ArrowBendUpLeftIcon />
          Restore
        </ContextMenuItem>
        <ContextMenuItem
          variant="destructive"
          onClick={() => onPermanentDelete(bookmark.id)}
        >
          <TrashIcon />
          Delete forever
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
