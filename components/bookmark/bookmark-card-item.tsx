import { GlobeIcon } from "@phosphor-icons/react";
import React from "react";

import type { BrokenStatus } from "~/lib/link-health/types";
import type { Tag } from "~/lib/schemas/tag.schema";

import { ProgressiveImage } from "~/components/progressive-image";
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
  favicon_url?: string | undefined;
  og_image_url?: string | undefined;
  created_at: string;
  note?: string | null;
  tags?: Tag[];
  httpStatus?: number | null;
  brokenStatus?: BrokenStatus | string | null;
  autoCheckBroken?: boolean | undefined;
  isSelected?: boolean | undefined;
  isSelectionMode?: boolean | undefined;
  bookmarkWorkspaceId?: string | null;
  workspaces?: { id: string; name: string }[];
  currentWorkspaceId?: string | undefined;
  onSelect?: ((id: string) => void) | undefined;
  onDelete?: ((id: string) => void) | undefined;
  onEdit?: ((id: string) => void) | undefined;
  onTagClick?: ((tagId: string) => void) | undefined;
  onMove?: ((id: string) => void) | undefined;
  onMoveToWorkspace?: ((id: string, workspaceId: string) => void) | undefined;
  onCopyUrl?: ((url: string) => void) | undefined;
  onRefetch?: ((id: string) => void) | undefined;
  onSelectionModeToggle?: (() => void) | undefined;
  tabIndex?: number | undefined;
  disableContextMenu?: boolean | undefined;
  refetchingId?: string | null;
}

interface BookmarkCardItemProps extends BookmarkItemProps {
  autoCheckBroken?: boolean;
}

export function BookmarkCardItem({
  id,
  title,
  url,
  og_image_url,
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
  refetchingId,
}: BookmarkCardItemProps) {
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
      data-bookmark-item
      data-bookmark-id={id}
      onKeyDown={handleKeyDown}
      className={cn(
        "group flex flex-col rounded-lg overflow-hidden hover-only:hover:bg-muted/50 h-full relative cursor-pointer transition-[background-color,box-shadow,transform] duration-200 ease-out active:scale-[0.98] text-left w-full",
        isSelected && "bg-primary/10",
      )}
      onClick={() => {
        if (isSelectionMode) {
          onSelect?.(id);
        } else {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      }}
    >
      {isSelectionMode && (
        <div className="absolute top-2 right-2 z-10">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelect?.(id)}
            onClick={(e) => e.stopPropagation()}
            className="bg-background shadow-lg"
          />
        </div>
      )}

      <div className="aspect-1200/628 w-full overflow-hidden relative">
        {og_image_url ? (
          <ProgressiveImage
            src={og_image_url}
            alt={title}
            containerClassName="w-full h-full"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <GlobeIcon className="w-12 h-12 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-6 pb-1.5 px-2">
          <h3 className="text-xs text-white/95 truncate leading-tight font-medium tracking-tight">
            {title}
          </h3>
        </div>
      </div>
      <div className="flex items-center px-4 py-3 justify-between w-full border-t border-border/60">
        <div className="flex gap-2 min-w-0 flex-1 mr-2">
          <div className="shrink-0 w-4 h-4 rounded-xs overflow-hidden flex items-center justify-center">
            {refetchingId === id ? (
              <Orb
                size={12}
                label="Refreshing metadata…"
                className="text-muted-foreground"
              />
            ) : favicon_url ? (
              // oxlint-disable-next-line next/no-img-element -- nothing to optimize
              <img
                src={favicon_url}
                alt={`${domain} favicon`}
                className="w-full h-full object-contain"
              />
            ) : (
              <GlobeIcon className="w-full h-full text-muted-foreground" />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{domain}</p>
          {workspaceName && (
            <>
              <span className="text-xs text-muted-foreground/60">·</span>
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
        <div className="grid grid-cols-1 grid-rows-1 place-items-center shrink-0 w-fit">
          <span className="col-start-1 row-start-1 text-[10px] text-muted-foreground tabular-nums transition-opacity group-hover:opacity-0 text-right w-full">
            {formatRelativeTime(created_at)}
          </span>
          <KbdGroup className="absolute right-3 col-start-1 row-start-1 text-xs transition-opacity opacity-0 group-hover:opacity-100 pointer-events-none">
            <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd>
          </KbdGroup>
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
      {(triggerProps) => (
        <div {...triggerProps} className="h-full">
          {buttonContent}
        </div>
      )}
    </BookmarkContextMenu>
  );
}
