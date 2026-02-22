import { GlobeIcon } from "@phosphor-icons/react";
import { Checkbox } from "~/components/ui/checkbox";
import { Kbd, KbdGroup } from "~/components/ui/kbd";
import { cn } from "~/lib/utils";
import { BookmarkContextMenu } from "./bookmark-context-menu";

interface BookmarkItemProps {
  id: string;
  title: string;
  url: string;
  domain: string;
  favicon_url?: string;
  og_image_url?: string;
  created_at: string;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  workspaces?: { id: string; name: string }[];
  currentWorkspaceId?: string | null;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string) => void;
  onMove?: (id: string) => void;
  onMoveToWorkspace?: (id: string, workspaceId: string) => void;
  onCopyUrl?: (url: string) => void;
  onSelectionModeToggle?: () => void;
  tabIndex?: number;
  disableContextMenu?: boolean;
}

interface BookmarkCardItemProps extends BookmarkItemProps {
  og_image_url?: string;
}

export function BookmarkCardItem({
  id,
  title,
  url,
  og_image_url,
  favicon_url,
  domain,
  created_at,
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
      onClick={() => window.open(url, "_blank")}
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

      <div className="aspect-1200/628 w-full bg-muted overflow-hidden relative">
        {og_image_url ? (
          // biome-ignore lint/performance/noImgElement: external domain source
          <img
            src={og_image_url}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <GlobeIcon className="w-12 h-12 text-muted-foreground/20" />
          </div>
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
          <p className="col-start-1 row-start-1 text-[10px] text-muted-foreground transition-opacity group-hover:opacity-0 text-right w-full">
            {new Date(created_at).toLocaleDateString()}
          </p>
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
