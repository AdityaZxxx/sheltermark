"use client";

import {
  ArrowClockwiseIcon,
  ArrowSquareOutIcon,
  CopyIcon,
  FolderOpenIcon,
  PencilIcon,
  SelectionPlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";

import type { Bookmark } from "~/lib/schemas/bookmark.schema";
import type { WorkspaceWithCount } from "~/lib/schemas/workspace.schema";

import {
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "~/components/ui/context-menu";
import { getPastelColor } from "~/lib/utils";

interface BookmarkContextMenuProps {
  activeBookmark: Bookmark | null;
  availableWorkspaces: WorkspaceWithCount[];
  isSelectionMode?: boolean;
  onSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
  onMove?: (id: string) => void;
  onMoveToWorkspace?: (id: string, workspaceId: string) => void;
  onCopyUrl?: (url: string) => void;
  onDelete?: (id: string) => void;
  onRefetch?: (id: string) => void;
  onSelectionModeToggle?: () => void;
}

export function BookmarkContextMenu({
  activeBookmark,
  availableWorkspaces,
  isSelectionMode,
  onSelect,
  onEdit,
  onMove,
  onMoveToWorkspace,
  onCopyUrl,
  onDelete,
  onRefetch,
  onSelectionModeToggle,
}: BookmarkContextMenuProps) {
  if (!activeBookmark) return null;

  const { id, url } = activeBookmark;

  const handleSelectionModeToggle = () => {
    if (!isSelectionMode) {
      onSelect?.(id);
      onSelectionModeToggle?.();
    }
  };

  return (
    <ContextMenuContent>
      <ContextMenuItem onClick={() => onEdit?.(id)}>
        <PencilIcon />
        Edit
      </ContextMenuItem>

      <ContextMenuItem onClick={() => onCopyUrl?.(url)}>
        <CopyIcon />
        Copy URL
      </ContextMenuItem>

      <ContextMenuItem
        onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
      >
        <ArrowSquareOutIcon />
        Open in new tab
      </ContextMenuItem>

      <ContextMenuItem onClick={() => onRefetch?.(id)}>
        <ArrowClockwiseIcon />
        Refresh Metadata
      </ContextMenuItem>

      {availableWorkspaces.length > 0 && (
        <ContextMenuSub>
          <ContextMenuSubTrigger className="flex items-center gap-2.5">
            <FolderOpenIcon />
            Move to...
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuGroup className="max-h-[50vh] overflow-y-auto overscroll-contain scroll-fade">
              {availableWorkspaces.map((ws) => (
                <ContextMenuItem
                  key={ws.id}
                  onClick={() => onMoveToWorkspace?.(id, ws.id)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: getPastelColor(ws.id) }}
                    />
                    <span className="truncate">{ws.name}</span>
                  </div>
                </ContextMenuItem>
              ))}
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onMove?.(id)}>
              More...
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}

      <ContextMenuSeparator />

      <ContextMenuItem onClick={handleSelectionModeToggle}>
        <SelectionPlusIcon />
        Select Multiple
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem variant="destructive" onClick={() => onDelete?.(id)}>
        <TrashIcon />
        Delete
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
