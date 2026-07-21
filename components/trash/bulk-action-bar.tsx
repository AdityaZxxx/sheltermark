"use client";

import {
  ArrowBendUpLeftIcon,
  CheckSquareIcon,
  TrashIcon,
  XIcon,
  XSquareIcon,
} from "@phosphor-icons/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

export function BulkActionBar({
  count,
  totalCount,
  onRestore,
  onPermanentDelete,
  onSelectAll,
  onClearSelection,
  isAllSelected,
  onExitSelectionMode,
  isRestoring,
  isDeleting,
}: {
  count: number;
  totalCount: number;
  onRestore: () => void;
  onPermanentDelete: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  isAllSelected: boolean;
  onExitSelectionMode: () => void;
  isRestoring?: boolean;
  isDeleting?: boolean;
}) {
  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
        "animate-in fade-in slide-in-from-bottom-5 duration-280",
      )}
    >
      <div className="flex flex-col items-center mb-4">
        <Badge>
          {count}/{totalCount} selected
        </Badge>
      </div>

      <div
        className={cn(
          "bg-popover border border-border shadow-xl rounded-xl px-4 py-2",
          "flex flex-col items-center gap-2 w-full",
          "backdrop-blur-sm bg-popover/95",
        )}
      >
        <div className="flex items-center">
          <Button
            variant="ghost"
            className={cn(
              "h-7 rounded-md gap-1.5",
              isAllSelected && "bg-accent text-accent-foreground",
            )}
            onClick={isAllSelected ? onClearSelection : onSelectAll}
            aria-label={isAllSelected ? "Deselect all" : "Select all"}
          >
            {isAllSelected ? <XSquareIcon /> : <CheckSquareIcon />}
            <span className="text-xs hidden md:block">
              {isAllSelected ? "Deselect All" : "Select All"}
            </span>
          </Button>

          <Button variant="ghost" onClick={onRestore} disabled={isRestoring}>
            <ArrowBendUpLeftIcon />
            {isRestoring ? "Restoring…" : "Restore"}
          </Button>

          <Separator orientation="vertical" />

          <Button
            variant="ghost"
            className="h-7 rounded-md gap-1.5 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
            onClick={onPermanentDelete}
            disabled={isDeleting}
            aria-label="Delete"
          >
            <TrashIcon />
            {isDeleting ? "Deleting…" : "Delete forever"}
          </Button>

          <div className="h-4 w-px bg-border" />
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onExitSelectionMode}
            aria-label="Exit selection mode"
          >
            <XIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
