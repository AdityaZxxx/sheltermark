import { GlobeIcon } from "@phosphor-icons/react";
import React from "react";
import { ProgressiveImage } from "~/components/progressive-image";
import { Checkbox } from "~/components/ui/checkbox";
import { formatRelativeTime } from "~/lib/format";
import type { Tag } from "~/lib/schemas/tag.schema";
import { type BrokenStatus, cn } from "~/lib/utils";
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
}

interface BookmarkComfortItemProps extends BookmarkItemProps {
  autoCheckBroken?: boolean;
}

export const BookmarkComfortItem = React.memo(function BookmarkComfortItem({
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
  tags = [],
}: BookmarkComfortItemProps) {
  const showWorkspaceBadge = !currentWorkspaceId && bookmarkWorkspaceId;
  const workspaceName = showWorkspaceBadge
    ? workspaces.find((ws) => ws.id === bookmarkWorkspaceId)?.name
    : null;
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      window.open(url, "_blank");
    }
  };

  const buttonContent = (
    <button
      type="button"
      tabIndex={tabIndex}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative flex flex-row gap-3 sm:gap-4 rounded-lg border p-3 overflow-hidden hover:bg-muted/50 w-full cursor-pointer transition-all text-left",
        isSelected && "bg-primary/5",
      )}
      onClick={() => {
        if (isSelectionMode) {
          onSelect?.(id);
        } else {
          window.open(url, "_blank");
        }
      }}
    >
      {isSelected && (
        <div className="absolute inset-0 rounded-sm pointer-events-none z-20" />
      )}
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
        <h3 className="text-base font-medium text-foreground truncate leading-snug tracking-tight">
          {title}
        </h3>
        {note && (
          <div className="pt-1.5">
            <p className="text-sm text-muted-foreground line-clamp-1 sm:line-clamp-2 leading-snug">
              <BookmarkNoteText text={note} />
            </p>
          </div>
        )}

        <div className="flex flex-row items-center gap-2 mt-4">
          <div className="shrink-0 w-4 h-4 rounded-xs overflow-hidden flex items-center justify-center">
            {favicon_url ? (
              // biome-ignore lint/performance/noImgElement: nothing to optimize
              <img
                src={favicon_url}
                alt={`${domain} favicon`}
                className="w-full h-full object-contain"
              />
            ) : (
              <GlobeIcon className="w-full h-full text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1 flex items-center gap-1">
            <p className="text-xs font-medium text-muted-foreground truncate">
              {domain}
            </p>
            {workspaceName && (
              <>
                <span className="text-xs text-muted-foreground/40">·</span>
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
          <div className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {formatRelativeTime(created_at)}
          </div>
        </div>

        {tags.length > 0 && (
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            {tags.slice(0, 2).map((tag) => (
              // biome-ignore lint/a11y/useSemanticElements: cannot be <button> inside parent <button>
              <span
                key={tag.id}
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
            {tags.slice(2, 4).map((tag) => (
              // biome-ignore lint/a11y/useSemanticElements: cannot be <button> inside parent <button>
              <span
                key={tag.id}
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
                className="hidden sm:block text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                #{tag.name}
              </span>
            ))}
            {tags.length > 2 && (
              <span className="sm:hidden text-xs text-muted-foreground/50">
                +{tags.length - 2}
              </span>
            )}
            {tags.length > 4 && (
              <span className="hidden sm:inline text-xs text-muted-foreground/50">
                +{tags.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="w-24 sm:w-36 shrink-0">
        {og_image_url ? (
          <ProgressiveImage
            src={og_image_url}
            alt={title}
            containerClassName="w-full aspect-video rounded-md overflow-hidden bg-muted"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="w-full aspect-video flex items-center justify-center bg-muted rounded-md">
            <GlobeIcon className="w-8 h-8 sm:w-12 sm:h-12 text-muted-foreground/20" />
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
});
