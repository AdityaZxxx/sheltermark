"use client";

import { CaretUpDownIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { moveBookmarks } from "~/app/action/bookmark";
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Label } from "~/components/ui/label";
import { getPastelColor } from "~/lib/utils";

interface BookmarkMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: string[];
  workspaces: { id: string; name: string }[];
  currentWorkspaceId?: string | null;
  onSuccess: () => void;
  onConfirm?: (
    ids: string[],
    targetWorkspaceId: string,
  ) => void | Promise<void>;
  silent?: boolean;
}

export function BookmarkMoveDialog({
  open,
  onOpenChange,
  ids,
  workspaces,
  currentWorkspaceId,
  onSuccess,
  onConfirm,
  silent = false,
}: BookmarkMoveDialogProps) {
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string | null>(
    null,
  );
  const [isPending, setIsPending] = useState(false);

  // Filter out the current workspace
  const availableWorkspaces = useMemo(
    () => workspaces.filter((ws) => ws.id !== currentWorkspaceId),
    [workspaces, currentWorkspaceId],
  );

  // Preselect the first available workspace only when the dialog opens
  useEffect(() => {
    if (open && availableWorkspaces.length > 0) {
      setTargetWorkspaceId((current) => current || availableWorkspaces[0].id);
    }
    if (!open) {
      setTargetWorkspaceId(null);
    }
  }, [open, availableWorkspaces]);

  const handleMove = async () => {
    if (ids.length === 0 || !targetWorkspaceId) return;

    setIsPending(true);

    if (onConfirm) {
      await onConfirm(ids, targetWorkspaceId);
      setIsPending(false);
      onSuccess();
      onOpenChange(false);
    } else {
      const res = await moveBookmarks(ids, targetWorkspaceId);
      setIsPending(false);

      if (res.success) {
        if (!silent) {
          toast.success(
            ids.length === 1
              ? "Bookmark moved"
              : `${ids.length} bookmarks moved`,
          );
        }
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(res.error || "Failed to move bookmarks");
      }
    }
  };

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const selectedWorkspace = workspaces.find(
    (ws) => ws.id === targetWorkspaceId,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Move {ids.length} Bookmark{ids.length > 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            Select a workspace to move{" "}
            {ids.length === 1 ? "this bookmark" : "these bookmarks"} to.
          </DialogDescription>
        </DialogHeader>
        <Label>Target Workspace</Label>
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                className="w-full justify-between px-3 h-10 font-normal"
                onClick={() => setIsMenuOpen(true)}
                disabled={availableWorkspaces.length === 0}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${getPastelColor(targetWorkspaceId || "default")}`}
                  />
                  <span className="truncate">
                    {selectedWorkspace?.name || "Select workspace..."}
                  </span>
                </div>
                <CaretUpDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              </Button>
            }
          />
          <DropdownMenuContent>
            <DropdownMenuRadioGroup
              value={targetWorkspaceId || ""}
              onValueChange={(val) => {
                setTargetWorkspaceId(val || null);
                setIsMenuOpen(false);
              }}
            >
              {availableWorkspaces.map((ws) => (
                <DropdownMenuRadioItem key={ws.id} value={ws.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${getPastelColor(ws.id)}`}
                    />
                    <span className="truncate">{ws.name}</span>
                  </div>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleMove}
            disabled={isPending || !targetWorkspaceId}
          >
            {isPending ? "Moving..." : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
