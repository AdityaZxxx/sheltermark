"use client";

import {
  ArrowBendUpLeftIcon,
  ArrowSquareOutIcon,
  DotsThreeIcon,
  GlobeIcon,
  SelectionPlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";

import type { Bookmark } from "~/lib/schemas/bookmark.schema";

import { ProgressiveImage } from "~/components/progressive-image";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn, safeDomain } from "~/lib/utils";
import { formatRelativeTime } from "~/lib/utils/format";

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
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- must be <div> to avoid <button> inside <button> hydration error; inner action buttons need a non-button parent
      role="button"
      tabIndex={showCheckbox ? 0 : -1}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/40 sm:gap-3 sm:px-4 sm:py-3",
        isSelected && "bg-muted/50",
        showCheckbox && "cursor-pointer",
      )}
      onClick={() => {
        if (showCheckbox) {
          onSelect(bookmark.id);
        } else {
          window.open(bookmark.url, "_blank", "noopener,noreferrer");
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
        <Button
          variant="ghost"
          size="icon"
          title="Restore"
          aria-label={`Restore ${bookmark.title || "bookmark"}`}
          className="hidden sm:inline-flex"
          onClick={(e) => {
            e.stopPropagation();
            onRestore(bookmark.id);
          }}
        >
          <ArrowBendUpLeftIcon className="size-4" />
        </Button>
        <Button
          variant="destructive"
          size="icon"
          title="Delete forever"
          aria-label={`Delete ${bookmark.title || "bookmark"} forever`}
          className="hidden sm:inline-flex"
          onClick={(e) => {
            e.stopPropagation();
            onPermanentDelete(bookmark.id);
          }}
        >
          <TrashIcon className="size-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Actions for ${bookmark.title || "bookmark"}`}
                className="inline-flex sm:hidden"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              />
            }
          >
            <DotsThreeIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onRestore(bookmark.id);
              }}
            >
              <ArrowBendUpLeftIcon />
              Restore
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                onPermanentDelete(bookmark.id);
              }}
            >
              <TrashIcon />
              Delete forever
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                window.open(bookmark.url, "_blank", "noopener,noreferrer");
              }}
            >
              <ArrowSquareOutIcon />
              Open link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
