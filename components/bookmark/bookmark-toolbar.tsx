import {
  CheckSquareIcon,
  CopyIcon,
  FolderOpenIcon,
  TrashIcon,
  XIcon,
  XSquareIcon,
} from "@phosphor-icons/react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

interface BookmarkToolbarProps {
  selectedCount: number;
  isSelectionMode: boolean;
  isAllSelected: boolean;
  onClear: () => void;
  onToggleSelectAll: () => void;
  onDelete: () => void;
  onMove: () => void;
  onCopyUrls: () => void;
  pendingAction?: "deleting" | "moving" | null;
}

export function BookmarkToolbar({
  selectedCount,
  isSelectionMode,
  isAllSelected,
  onClear,
  onToggleSelectAll,
  onDelete,
  onMove,
  onCopyUrls,
  pendingAction = null,
}: BookmarkToolbarProps) {
  if (!isSelectionMode) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
        "animate-in fade-in slide-in-from-bottom-5 duration-280",
      )}
    >
      <div className="flex flex-col items-center mb-2">
        <Badge>{selectedCount} selected</Badge>
      </div>

      <div
        className={cn(
          "bg-popover/95 shadow-xl rounded-xl p-1.5 mb-2",
          "flex flex-col items-center gap-2 w-full",
          "backdrop-blur-sm bg-popover/95",
        )}
      >
        <div className="flex items-center">
          <Button
            variant="ghost"
            className={cn(
              "h-10 rounded-md gap-1.5",
              isAllSelected && "bg-accent text-accent-foreground",
            )}
            onClick={onToggleSelectAll}
            aria-label={isAllSelected ? "Deselect all" : "Select all"}
          >
            {isAllSelected ? (
              <XSquareIcon className="size-4.5" />
            ) : (
              <CheckSquareIcon className="size-4.5" />
            )}
            <span className="text-xs hidden md:block">
              {isAllSelected ? "Deselect All" : "Select All"}
            </span>
          </Button>

          <Button
            variant="ghost"
            className="h-10 rounded-md gap-1.5"
            onClick={onCopyUrls}
            aria-label="Copy URLs"
            disabled={!selectedCount}
          >
            <CopyIcon className="size-4.5" />
            <span className="text-xs hidden md:block">
              {selectedCount > 1 ? "Copy URLs" : "Copy URL"}
            </span>
          </Button>
          <Button
            variant="ghost"
            className="h-10 rounded-md gap-1.5"
            onClick={onMove}
            aria-label="Move"
            disabled={!selectedCount || pendingAction === "moving"}
          >
            <FolderOpenIcon className="size-4.5" />
            <span className="text-xs hidden md:block">
              {pendingAction === "moving" ? "Moving…" : "Move"}
            </span>
          </Button>

          <Separator orientation="vertical" />

          <Button
            variant="ghost"
            className="h-10 rounded-md gap-1.5 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            aria-label="Delete"
            disabled={!selectedCount || pendingAction === "deleting"}
          >
            <TrashIcon className="size-4.5" />
            <span className="text-xs hidden md:block">
              {pendingAction === "deleting" ? "Deleting…" : "Delete"}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-9 rounded-md"
            onClick={onClear}
            aria-label="Clear selection"
          >
            <XIcon className="size-4.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
