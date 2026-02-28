import {
  CopyIcon,
  FolderOpenIcon,
  PencilIcon,
  SelectionPlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";
import { cn, getPastelColor } from "~/lib/utils";

interface BookmarkContextMenuProps {
  children: (props: React.HTMLAttributes<HTMLElement>) => React.ReactElement;
  id: string;
  url: string;
  isSelectionMode?: boolean;
  workspaces?: { id: string; name: string }[];
  currentWorkspaceId?: string | null;
  onSelect?: (id: string) => void;
  onRename?: (id: string) => void;
  onMove?: (id: string) => void;
  onMoveToWorkspace?: (id: string, workspaceId: string) => void;
  onCopyUrl?: (url: string) => void;
  onDelete?: (id: string) => void;
  onSelectionModeToggle?: () => void;
}

export function BookmarkContextMenu({
  children,
  id,
  url,
  isSelectionMode,
  workspaces = [],
  currentWorkspaceId,
  onSelect,
  onRename,
  onMove,
  onMoveToWorkspace,
  onCopyUrl,
  onDelete,
  onSelectionModeToggle,
}: BookmarkContextMenuProps) {
  const handleSelectionModeToggle = () => {
    if (!isSelectionMode) {
      onSelect?.(id);
      onSelectionModeToggle?.();
    }
  };

  const availableWorkspaces = workspaces.filter(
    (ws) => ws.id !== currentWorkspaceId,
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger render={children} />
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onRename?.(id)}>
          <PencilIcon />
          Rename
        </ContextMenuItem>

        <ContextMenuItem onClick={() => onCopyUrl?.(url)}>
          <CopyIcon />
          Copy URL
        </ContextMenuItem>

        {availableWorkspaces.length > 0 && (
          <ContextMenuSub>
            <ContextMenuSubTrigger className="flex items-center gap-2.5">
              <FolderOpenIcon />
              Move to...
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuGroup>
                {availableWorkspaces.map((ws) => (
                  <ContextMenuItem
                    key={ws.id}
                    onClick={() => onMoveToWorkspace?.(id, ws.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          getPastelColor(ws.id),
                        )}
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
    </ContextMenu>
  );
}
