"use client";

import {
  CaretUpDownIcon,
  GlobeIcon,
  GlobeXIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { getPastelColor } from "~/lib/utils";
import type { Workspace } from "~/types/workspace.types";

interface DemoWorkspaceMenuProps {
  workspaces: Workspace[];
  currentWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
}

export function DemoWorkspaceMenu({
  workspaces,
  currentWorkspaceId,
  onSelectWorkspace,
}: DemoWorkspaceMenuProps) {
  const currentWorkspace = workspaces.find(
    (ws) => ws.id === currentWorkspaceId,
  );
  const activeWorkspaceName = currentWorkspace?.name || "Personal";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="gap-2 justify-between outline-none"
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${getPastelColor(currentWorkspaceId || "default")}`}
              />
              <span className="truncate max-w-[100px]">
                {activeWorkspaceName}
              </span>
            </div>
            <CaretUpDownIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" sideOffset={8} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup
            value={currentWorkspaceId}
            onValueChange={onSelectWorkspace}
          >
            {workspaces.map((ws) => (
              <DropdownMenuRadioItem value={ws.id} key={ws.id}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${getPastelColor(ws.id)}`}
                  />
                  <span className="truncate">{ws.name}</span>
                  {ws.is_public && (
                    <GlobeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
                {currentWorkspace?.id !== ws.id && (
                  <span className="absolute right-2 text-xs text-muted-foreground">
                    {ws.bookmarks_count}
                  </span>
                )}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Workspace
        </DropdownMenuItem>

        <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">
          {currentWorkspace?.is_public ? (
            <>
              <GlobeXIcon className="h-4 w-4 mr-2" />
              Make Private
            </>
          ) : (
            <>
              <GlobeIcon className="h-4 w-4 mr-2" />
              Make Public
            </>
          )}
        </DropdownMenuItem>

        {workspaces.length > 1 && (
          <DropdownMenuItem
            disabled
            className="opacity-50 cursor-not-allowed text-destructive"
          >
            <TrashIcon className="h-4 w-4 mr-2" />
            Delete Workspace
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
