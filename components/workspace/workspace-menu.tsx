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
import { WorkspaceAddDialog } from "./workspace-add-dialog";
import { WorkspaceDeleteDialog } from "./workspace-delete-dialog";
import { WorkspacePrivateDialog } from "./workspace-private-dialog";
import { WorkspacePublicDialog } from "./workspace-public-dialog";

const workspacesMock = [
  {
    id: "1",
    name: "Personal",
    is_default: true,
    is_public: false,
    bookmarks_count: 10,
  },
  {
    id: "2",
    name: "Work",
    is_default: false,
    is_public: true,
    bookmarks_count: 20,
  },
  {
    id: "3",
    name: "College",
    is_default: false,
    is_public: false,
    bookmarks_count: 0,
  },
];

export function WorkspaceMenu() {
  const [workspaces, setWorkspaces] = useState(workspacesMock);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("1");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPublicDialogOpen, setIsPublicDialogOpen] = useState(false);
  const [isPrivateDialogOpen, setIsPrivateDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const currentWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId);
  const activeWorkspaceName = currentWorkspace?.name || "";

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      console.log("Deleting workspace:", activeWorkspaceId);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setWorkspaces(workspaces.filter((ws) => ws.id !== activeWorkspaceId));
      setActiveWorkspaceId("1"); // Fallback to personal
      setIsDeleteDialogOpen(false);
    } catch (_err) {
      setDeleteError("Failed to delete workspace");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddWorkspace = (name: string) => {
    const newWs = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      is_default: false,
      is_public: false,
      bookmarks_count: 0,
    };
    setWorkspaces([...workspaces, newWs]);
    setActiveWorkspaceId(newWs.id);
    setIsAddDialogOpen(false);
  };

  const handleTogglePublic = () => {
    if (currentWorkspace?.is_public) {
      setIsPrivateDialogOpen(true);
    } else {
      setIsPublicDialogOpen(true);
    }
  };

  const handleMakePrivateConfirm = () => {
    setWorkspaces(
      workspaces.map((ws) =>
        ws.id === activeWorkspaceId ? { ...ws, is_public: false } : ws,
      ),
    );
    setIsPrivateDialogOpen(false);
  };

  const handleMakePublicConfirm = () => {
    setWorkspaces(
      workspaces.map((ws) =>
        ws.id === activeWorkspaceId ? { ...ws, is_public: true } : ws,
      ),
    );
    setIsPublicDialogOpen(false);
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
                  className={`w-2.5 h-2.5 rounded-full ${getPastelColor(activeWorkspaceName)}`}
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
              value={activeWorkspaceId}
              onValueChange={setActiveWorkspaceId}
            >
              {workspaces.map((ws) => (
                <DropdownMenuRadioItem value={ws.id} key={ws.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${getPastelColor(ws.name)}`}
                    />
                    <span className="truncate">{ws.name}</span>
                    {ws.is_public && (
                      <GlobeIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  {activeWorkspaceId !== ws.id && (
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
            onClick={() => setIsAddDialogOpen(true)}
          >
            <PlusIcon className="h-4 w-4" />
            Add Workspace
          </DropdownMenuItem>

          <DropdownMenuItem
            nativeButton
            className="w-full gap-1.5"
            onClick={handleTogglePublic}
          >
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
          </DropdownMenuItem>

          {workspaces.length > 1 && (
            <DropdownMenuItem
              nativeButton
              className="w-full gap-1.5"
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <TrashIcon className="h-4 w-4" />
              Delete Workspace
            </DropdownMenuItem>
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
        error={deleteError}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        isDefault={currentWorkspace?.is_default}
      />

      <WorkspacePublicDialog
        isOpen={isPublicDialogOpen}
        onOpenChange={setIsPublicDialogOpen}
        onConfirm={handleMakePublicConfirm}
      />

      <WorkspacePrivateDialog
        isOpen={isPrivateDialogOpen}
        onOpenChange={setIsPrivateDialogOpen}
        onConfirm={handleMakePrivateConfirm}
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
