import { GlobeIcon, WarningIcon } from "@phosphor-icons/react";
import { ProgressiveImage } from "~/components/progressive-image";
import { Checkbox } from "~/components/ui/checkbox";
import { Kbd, KbdGroup } from "~/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { formatRelativeTime } from "~/lib/format";
import { cn, getBrokenLinkMessage } from "~/lib/utils";
import { BookmarkContextMenu } from "./bookmark-context-menu";

interface BookmarkItemProps {
  id: string;
  title: string;
  url: string;
  domain: string;
  favicon_url?: string;
  og_image_url?: string;
  created_at: string;
  isBroken?: boolean;
  httpStatus?: number | null;
  autoCheckBroken?: boolean;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  workspaces?: { id: string; name: string }[];
  currentWorkspaceId?: string;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string) => void;
  onMove?: (id: string) => void;
  onMoveToWorkspace?: (id: string, workspaceId: string) => void;
  onCopyUrl?: (url: string) => void;
  onRefetch?: (id: string) => void;
  onSelectionModeToggle?: () => void;
  tabIndex?: number;
  disableContextMenu?: boolean;
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
  isBroken,
  httpStatus,
  autoCheckBroken = true,
  isSelected,
  isSelectionMode,
  workspaces = [],
  currentWorkspaceId,
  onSelect,
  onDelete,
  onRename,
  onMove,
  onMoveToWorkspace,
  onCopyUrl,
  onRefetch,
  onSelectionModeToggle,
  tabIndex,
  disableContextMenu = false,
}: BookmarkCardItemProps) {
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
        "group flex flex-col rounded-sm overflow-hidden hover:bg-muted/50 h-full relative cursor-pointer transition-all text-left w-full  ",
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
            <GlobeIcon className="w-12 h-12 text-muted-foreground/20" />
          </div>
        )}
        {isBroken && autoCheckBroken && (
          <Tooltip>
            <TooltipTrigger
              render={
                <div className="absolute top-2 left-2 z-10 cursor-help">
                  <div className="w-6 h-6 rounded-full bg-red-500/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                    <WarningIcon
                      className="w-3.5 h-3.5 text-white"
                      weight="fill"
                    />
                  </div>
                </div>
              }
            />
            <TooltipContent>
              <span>{getBrokenLinkMessage(httpStatus)}</span>
            </TooltipContent>
          </Tooltip>
        )}
        <div className="absolute bottom-0.5 left-1 right-1 bg-black/60 px-2 py-1 mx-auto">
          <h3 className="text-[10px] text-white truncate leading-none font-medium">
            {title}
          </h3>
        </div>
      </div>
      <div className="flex items-center px-4 py-3 justify-between w-full">
        <div className="flex gap-2 min-w-0 flex-1 mr-2">
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
          <p className="text-xs font-medium text-muted-foreground truncate">
            {domain}
          </p>
        </div>
        <div className="grid grid-cols-1 grid-rows-1 place-items-center shrink-0 min-w-[80px]">
          <span className="col-start-1 row-start-1 text-[10px] text-muted-foreground transition-opacity group-hover:opacity-0 text-right w-full">
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
      onRename={onRename}
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
