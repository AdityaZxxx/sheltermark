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

interface BookmarkListItemProps extends BookmarkItemProps {}

export function BookmarkListItem({
  id,
  title,
  url,
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
}: BookmarkListItemProps) {
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
        "group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-all text-left w-full relative",
        isSelected && "bg-primary/5",
      )}
      onClick={(e) => {
        if (isSelectionMode) {
          e.preventDefault();
          onSelect?.(id);
        } else {
          window.open(url, "_blank");
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

      <div className="shrink-0 w-6 h-6 rounded-md overflow-hidden flex items-center justify-center">
        {favicon_url ? (
          // biome-ignore lint/performance/noImgElement: nothing to optimize
          <img src={favicon_url} alt="" className="w-4 h-4 object-contain" />
        ) : (
          <GlobeIcon className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 flex items-center justify-between min-w-0">
        <div className="flex-1 min-w-0 flex items-center gap-2 mr-2">
          <p
            className={cn(
              "text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors min-w-0",
              isSelected && "text-primary",
            )}
          >
            {title}
          </p>
          <p className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
            {domain}
          </p>
        </div>

        <div className="relative shrink-0 ml-10 text-xs text-muted-foreground">
          <span className="transition-opacity group-hover:opacity-0">
            {new Date(created_at).toLocaleDateString()}
          </span>

          <KbdGroup className="absolute inset-0 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
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
      {(triggerProps) => <div {...triggerProps}>{buttonContent}</div>}
    </BookmarkContextMenu>
  );
}
