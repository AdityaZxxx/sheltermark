import { GlobeIcon } from "@phosphor-icons/react";
import React from "react";

import type { BrokenStatus } from "~/lib/link-health/types";
import type { Tag } from "~/lib/schemas/tag.schema";

import { Checkbox } from "~/components/ui/checkbox";
import { Kbd, KbdGroup } from "~/components/ui/kbd";
import { cn } from "~/lib/utils";
import { formatRelativeTime } from "~/lib/utils/format";

import { BookmarkContextMenu } from "./bookmark-context-menu";
import { BrokenLinkWarning } from "./broken-link-warning";
import { Orb } from "./orb";

interface BookmarkItemProps {
  id: string;
  title: string;
  url: string;
  domain: string;
  favicon_url?: string;
  og_image_url?: string;
  created_at: string;
  note?: string | null;
  tags?: Tag[];
  httpStatus?: number | null;
  brokenStatus?: BrokenStatus | string | null;
  autoCheckBroken?: boolean;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  bookmarkWorkspaceId?: string | null;
  workspaces?: { id: string; name: string }[];
  currentWorkspaceId?: string;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onTagClick?: (tagId: string) => void;
  onMove?: (id: string) => void;
  onMoveToWorkspace?: (id: string, workspaceId: string) => void;
  onCopyUrl?: (url: string) => void;
  onRefetch?: (id: string) => void;
  onSelectionModeToggle?: () => void;
  tabIndex?: number;
  disableContextMenu?: boolean;
  showKbdHint?: boolean;
  refetchingId?: string | null;
}

interface BookmarkListItemProps extends BookmarkItemProps {
  autoCheckBroken?: boolean;
}

export function BookmarkListItem({
  id,
  title,
  url,
  favicon_url,
  domain,
  created_at,
  httpStatus,
  brokenStatus,
  autoCheckBroken = true,
  isSelected,
  isSelectionMode,
  bookmarkWorkspaceId,
  workspaces = [],
  currentWorkspaceId,
  onSelect,
  onDelete,
  onEdit,
  onMove,
  onMoveToWorkspace,
  onCopyUrl,
  onRefetch,
  onSelectionModeToggle,
  tabIndex,
  disableContextMenu = false,
  showKbdHint = true,
  refetchingId,
}: BookmarkListItemProps) {
  const showWorkspaceBadge = !currentWorkspaceId && bookmarkWorkspaceId;
  const workspaceName = showWorkspaceBadge
    ? workspaces.find((ws) => ws.id === bookmarkWorkspaceId)?.name
    : null;
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const buttonContent = (
    <button
      type="button"
      tabIndex={tabIndex}
      onKeyDown={handleKeyDown}
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-lg hover-only:hover:bg-muted/50 transition-[background-color,box-shadow,transform] duration-200 ease-out active:scale-[0.98] text-left w-full relative",
        isSelected && "bg-primary/10",
      )}
      onClick={(e) => {
        if (isSelectionMode) {
          e.preventDefault();
          onSelect?.(id);
        } else {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      }}
    >
      {isSelectionMode && (
        <div className="shrink-0 flex items-center justify-center mr-1 z-10">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelect?.(id)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-6 h-6 overflow-hidden rounded-xs flex items-center justify-center">
            {refetchingId === id ? (
              <Orb
                size={16}
                label="Refreshing metadata…"
                className="text-muted-foreground"
              />
            ) : favicon_url ? (
              // oxlint-disable-next-line next/no-img-element -- nothing to optimize
              <img
                src={favicon_url}
                alt=""
                className="w-full h-full object-contain"
              />
            ) : (
              <GlobeIcon className="w-full h-full text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm font-medium truncate text-foreground tracking-tight leading-snug hover-only:group-hover:text-primary transition-colors pr-2",
                isSelected && "text-primary",
              )}
            >
              {title}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pl-9 sm:pl-0 w-full sm:w-auto sm:flex-1">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <p className="text-xs text-muted-foreground truncate">{domain}</p>
            {workspaceName && (
              <>
                <span className="text-xs text-muted-foreground/60 shrink-0">
                  ·
                </span>
                <span className="text-xs text-muted-foreground/60 truncate shrink-0">
                  {workspaceName}
                </span>
              </>
            )}
            {autoCheckBroken && (
              <BrokenLinkWarning
                brokenStatus={brokenStatus}
                httpStatus={httpStatus}
                autoCheckBroken={autoCheckBroken}
              />
            )}
          </div>
          <div className="relative shrink-0 text-xs text-muted-foreground">
            <span
              className={cn(
                "transition-opacity",
                showKbdHint && "group-hover:opacity-0",
              )}
            >
              {formatRelativeTime(created_at)}
            </span>

            {showKbdHint && (
              <KbdGroup className="absolute inset-0 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <Kbd>⌘</Kbd>
                <Kbd>↵</Kbd>
              </KbdGroup>
            )}
          </div>
        </div>
      </div>
    </button>
  );

  if (disableContextMenu) {
    return buttonContent;
  }

  return (
    <BookmarkContextMenu
      id={id}
      url={url}
      isSelectionMode={isSelectionMode}
      workspaces={workspaces}
      currentWorkspaceId={currentWorkspaceId}
      onSelect={onSelect}
      onDelete={onDelete}
      onEdit={onEdit}
      onMove={onMove}
      onMoveToWorkspace={onMoveToWorkspace}
      onCopyUrl={onCopyUrl}
      onRefetch={onRefetch}
      onSelectionModeToggle={onSelectionModeToggle}
    >
      {(triggerProps) => <div {...triggerProps}>{buttonContent}</div>}
    </BookmarkContextMenu>
  );
}
