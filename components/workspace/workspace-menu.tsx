"use client";

import {
  CaretUpDownIcon,
  GlobeIcon,
  GlobeXIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useWorkspaces } from "~/hooks/use-workspaces";
import { WorkspaceAddDialog } from "./workspace-add-dialog";
import { WorkspaceDeleteDialog } from "./workspace-delete-dialog";
import { WorkspacePrivateDialog } from "./workspace-private-dialog";
import { WorkspacePublicDialog } from "./workspace-public-dialog";

export function WorkspaceMenu() {
  const {
    workspaces,
    currentWorkspace,
    isLoading,
    setActiveWorkspace,
    createWorkspace,
    deleteWorkspace,
    isDeleting,
    togglePublicStatus,
  } = useWorkspaces();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPublicDialogOpen, setIsPublicDialogOpen] = useState(false);
  const [isPrivateDialogOpen, setIsPrivateDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <Button
        variant="ghost"
        className="gap-2 justify-between outline-none"
        disabled
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-muted animate-pulse" />
          <span className="truncate max-w-[100px]">Loading...</span>
        </div>
        <CaretUpDownIcon className="h-4 w-4 text-muted-foreground" />
      </Button>
    );
  }

  const activeWorkspaceName = currentWorkspace?.name || "";

  const handleTogglePublic = () => {
    if (currentWorkspace) {
      if (currentWorkspace.is_public) {
        setIsPrivateDialogOpen(true);
      } else {
        setIsPublicDialogOpen(true);
      }
    }
  };

  const handleAddWorkspace = (name: string) => {
    const formData = new FormData();
    formData.append("name", name);
    createWorkspace(formData);
    setIsAddDialogOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="gap-2 justify-between outline-none"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${getPastelColor(currentWorkspace?.id || "default")}`}
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
            <DropdownMenuLabel className="sr-only">
              Workspaces
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={currentWorkspace?.id}
              onValueChange={setActiveWorkspace}
            >
              {workspaces.map((ws) => (
                <DropdownMenuRadioItem value={ws.id} key={ws.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${getPastelColor(ws.id)}`}
                    />
                    <span className="truncate">{ws.name}</span>
                    {ws.is_public && (
                      <GlobeIcon className="h-4 w-4 text-muted-foreground" />
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

          <DropdownMenuItem
            nativeButton
            className="w-full gap-1.5"
            render={(props) => (
              <button {...props} onClick={() => setIsAddDialogOpen(true)}>
                <PlusIcon className="h-4 w-4" />
                Add Workspace
              </button>
            )}
          />

          <DropdownMenuItem
            nativeButton
            className="w-full gap-1.5"
            render={(props) => (
              <button {...props} onClick={handleTogglePublic}>
                {currentWorkspace?.is_public ? (
                  <>
                    <GlobeXIcon className="h-4 w-4" />
                    Make Private
                  </>
                ) : (
                  <>
                    <GlobeIcon className="h-4 w-4" />
                    Make Public
                  </>
                )}
              </button>
            )}
          />

          {workspaces.length > 1 && (
            <DropdownMenuItem
              nativeButton
              className="w-full gap-1.5"
              variant="destructive"
              render={(props) => (
                <button {...props} onClick={() => setIsDeleteDialogOpen(true)}>
                  <TrashIcon className="h-4 w-4" />
                  Delete Workspace
                </button>
              )}
            />
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <WorkspaceAddDialog
        isOpen={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAdd={handleAddWorkspace}
      />

      <WorkspaceDeleteDialog
        isOpen={isDeleteDialogOpen}
        isDeleting={isDeleting}
        workspaceName={activeWorkspaceName}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={async () => {
          if (currentWorkspace) {
            deleteWorkspace(currentWorkspace.id);
            setIsDeleteDialogOpen(false);
          }
        }}
        isDefault={currentWorkspace?.is_default}
      />

      <WorkspacePublicDialog
        isOpen={isPublicDialogOpen}
        onOpenChange={setIsPublicDialogOpen}
        onConfirm={() => {
          if (currentWorkspace) {
            togglePublicStatus({ id: currentWorkspace.id, isPublic: true });
            setIsPublicDialogOpen(false);
          }
        }}
      />

      <WorkspacePrivateDialog
        isOpen={isPrivateDialogOpen}
        onOpenChange={setIsPrivateDialogOpen}
        onConfirm={() => {
          if (currentWorkspace) {
            togglePublicStatus({ id: currentWorkspace.id, isPublic: false });
            setIsPrivateDialogOpen(false);
          }
        }}
      />
    </>
  );
}

const PASTEL_COLORS = [
  "bg-red-300",
  "bg-orange-300",
  "bg-amber-300",
  "bg-yellow-300",
  "bg-lime-300",
  "bg-green-300",
  "bg-emerald-300 ",
  "bg-teal-300 ",
  "bg-cyan-300 ",
  "bg-sky-300 ",
  "bg-blue-300 ",
  "bg-indigo-300 ",
  "bg-violet-300 ",
  "bg-purple-300 ",
  "bg-fuchsia-300 ",
  "bg-pink-300 ",
  "bg-rose-300 ",
];

function getPastelColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PASTEL_COLORS.length;
  return PASTEL_COLORS[index];
}
