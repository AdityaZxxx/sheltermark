import { ArrowClockwiseIcon, GlobeIcon } from "@phosphor-icons/react";
import React from "react";

import type { BrokenStatus } from "~/lib/link-health/types";
import type { Tag } from "~/lib/schemas/tag.schema";

import { ProgressiveImage } from "~/components/progressive-image";
import { Checkbox } from "~/components/ui/checkbox";
import { Kbd, KbdGroup } from "~/components/ui/kbd";
import { cn } from "~/lib/utils";
import { formatRelativeTime } from "~/lib/utils/format";

import { BookmarkContextMenu } from "./bookmark-context-menu";
import { BookmarkNoteText } from "./bookmark-note-text";
import { BrokenLinkWarning } from "./broken-link-warning";

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

interface BookmarkComfortItemProps extends BookmarkItemProps {
  autoCheckBroken?: boolean;
}

export function BookmarkComfortItem({
  id,
  title,
  url,
  og_image_url,
  favicon_url,
  domain,
  created_at,
  note,
  httpStatus,
  brokenStatus,
  tags,
  autoCheckBroken = true,
  isSelected,
  isSelectionMode,
  bookmarkWorkspaceId,
  workspaces = [],
  currentWorkspaceId,
  onSelect,
  onDelete,
  onEdit,
  onTagClick,
  onMove,
  onMoveToWorkspace,
  onCopyUrl,
  onRefetch,
  onSelectionModeToggle,
  tabIndex,
  disableContextMenu = false,
  refetchingId,
}: BookmarkComfortItemProps) {
  const safeTags = tags ?? [];
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
        "group relative flex flex-row gap-3 md:gap-4 rounded-lg p-3 overflow-hidden hover-only:hover:bg-muted/50 w-full cursor-pointer transition-[background-color,box-shadow,transform] duration-200 ease-out active:scale-[0.98] text-left",
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

      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-sm font-medium text-foreground truncate leading-snug tracking-tight">
          {title}
        </p>
        {note && (
          <div className="pt-1.5">
            <p className="text-sm text-muted-foreground line-clamp-2 leading-snug">
              <BookmarkNoteText text={note} />
            </p>
          </div>
        )}

        <div className="flex flex-row items-center gap-2 mt-4">
          <div className="shrink-0 w-4 h-4 rounded-xs overflow-hidden flex items-center justify-center relative">
            {favicon_url ? (
              // oxlint-disable-next-line next/no-img-element -- nothing to optimize
              <img
                src={favicon_url}
                alt={`${domain} favicon`}
                className={cn(
                  "w-full h-full object-contain transition-opacity",
                  refetchingId === id && "opacity-30",
                )}
              />
            ) : (
              <GlobeIcon className="w-full h-full text-muted-foreground" />
            )}
            {refetchingId === id && (
              <ArrowClockwiseIcon className="absolute inset-0 m-auto size-2.5 text-muted-foreground animate-spin" />
            )}
          </div>
          <div className="min-w-0 flex-1 flex items-center gap-1">
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
          <div className="relative shrink-0 text-xs text-muted-foreground">
            <span className="tabular-nums transition-opacity group-hover:opacity-0">
              {formatRelativeTime(created_at)}
            </span>
            <KbdGroup className="absolute inset-0 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <Kbd>⌘</Kbd>
              <Kbd>↵</Kbd>
            </KbdGroup>
          </div>
        </div>

        {safeTags.length > 0 && (
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            {safeTags.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- cannot be <button> inside parent <button>
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick?.(tag.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onTagClick?.(tag.id);
                  }
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                #{tag.name}
              </span>
            ))}
            {safeTags.slice(2, 4).map((tag) => (
              <span
                key={tag.id}
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- cannot be <button> inside parent <button>
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick?.(tag.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onTagClick?.(tag.id);
                  }
                }}
                className="hidden md:block text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                #{tag.name}
              </span>
            ))}
            {safeTags.length > 2 && (
              <span className="md:hidden text-xs text-muted-foreground/60">
                +{safeTags.length - 2}
              </span>
            )}
            {safeTags.length > 4 && (
              <span className="hidden md:inline text-xs text-muted-foreground/60">
                +{safeTags.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="w-28 md:w-36 shrink-0">
        {og_image_url ? (
          <ProgressiveImage
            src={og_image_url}
            alt={title}
            containerClassName="w-full aspect-video rounded-md overflow-hidden bg-muted"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="w-full aspect-video flex items-center justify-center bg-muted rounded-md">
            <GlobeIcon className="w-10 h-10 md:w-12 md:h-12 text-muted-foreground/40" />
          </div>
        )}
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
