"use client";

import { CaretUpDownIcon, GlobeIcon, LinkIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useBookmarks } from "~/hooks/use-bookmarks";
import type { WorkspaceWithCount } from "~/lib/schemas/workspace";
import { getPastelColor } from "~/lib/utils";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title?: string;
  workspaces: WorkspaceWithCount[];
  currentWorkspaceId?: string;
  onSuccess: () => void;
}

export function ShareDialog({
  open,
  onOpenChange,
  url,
  title: initialTitle,
  workspaces,
  currentWorkspaceId,
  onSuccess,
}: ShareDialogProps) {
  const { addBookmark } = useBookmarks();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null,
  );
  const [title, setTitle] = useState(initialTitle || "");

  useEffect(() => {
    if (open) {
      setSelectedWorkspaceId(currentWorkspaceId || workspaces[0]?.id || null);
      setTitle(initialTitle || "");
    }
  }, [open, currentWorkspaceId, workspaces, initialTitle]);

  const handleSave = () => {
    if (!selectedWorkspaceId) {
      toast.error("Please select a workspace");
      return;
    }

    addBookmark({
      url,
      workspaceId: selectedWorkspaceId,
    });

    onSuccess();
    onOpenChange(false);
  };

  const displayUrl = url.length > 60 ? `${url.slice(0, 60)}...` : url;
  const workspaceName = workspaces.find(
    (ws) => ws.id === selectedWorkspaceId,
  )?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[85vh] overflow-y-auto transition-all duration-200">
        <DialogHeader className="pb-2">
          <DialogTitle>Add Bookmark</DialogTitle>
          <DialogDescription>
            Save this link to one of your workspaces.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/40 px-3 py-2">
          <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs text-muted-foreground">
            {displayUrl}
          </span>
        </div>

        <div className="space-y-2">
          <Label htmlFor="share-title">Title</Label>
          <Input
            id="share-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Page title"
          />
        </div>

        <div className="space-y-2">
          <Label>Save to workspace</Label>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" className="w-full justify-between ">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: getPastelColor(
                          selectedWorkspaceId || "default",
                        ),
                      }}
                    />
                    <span className="truncate">
                      {selectedWorkspaceId
                        ? workspaces.find((ws) => ws.id === selectedWorkspaceId)
                            ?.name
                        : "Select workspace"}{" "}
                    </span>
                  </div>
                  <CaretUpDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                </Button>
              }
            />
            <DropdownMenuContent>
              {workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => setSelectedWorkspaceId(ws.id)}
                  className="flex items-center gap-2"
                >
                  <div
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: getPastelColor(ws.id) }}
                  />
                  <span className="truncate">{ws.name}</span>
                  {ws.is_public && (
                    <GlobeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <DialogFooter className="pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!selectedWorkspaceId}>
            {`Save to ${workspaceName || "workspace"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
