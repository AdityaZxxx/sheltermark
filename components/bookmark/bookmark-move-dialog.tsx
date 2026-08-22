"use client";

import { CaretUpDownIcon } from "@phosphor-icons/react";
import { useId, useState } from "react";
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
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Label } from "~/components/ui/label";
import { useBookmarkMutations } from "~/hooks/use-bookmark-mutations";
import { getPastelColor } from "~/lib/utils";

interface BookmarkMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: string[];
  workspaces: { id: string; name: string }[];
  currentWorkspaceId?: string;
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <MoveForm
          key={ids.join(",")}
          ids={ids}
          workspaces={workspaces}
          currentWorkspaceId={currentWorkspaceId}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
          onConfirm={onConfirm}
          silent={silent}
        />
      )}
    </Dialog>
  );
}

function MoveForm({
  ids,
  workspaces,
  currentWorkspaceId,
  onOpenChange,
  onSuccess,
  onConfirm,
  silent,
}: Omit<BookmarkMoveDialogProps, "open">) {
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string | null>(
    null,
  );
  const { moveBookmarks, isMovingBookmarks } = useBookmarkMutations();

  const isPending = isMovingBookmarks;

  const availableWorkspaces = workspaces.filter(
    (ws) => ws.id !== currentWorkspaceId,
  );

  const handleMove = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (ids.length === 0 || !targetWorkspaceId) return;

    if (onConfirm) {
      // Parent-supplied handler (backward compat)
      const result = onConfirm(ids, targetWorkspaceId);
      if (result instanceof Promise) {
        result.then(() => {
          onSuccess();
          onOpenChange(false);
        });
      } else {
        onSuccess();
        onOpenChange(false);
      }
      return;
    }

    // Optimistic move via the shared hook. Cache updates instantly; toast
    // dialog closes immediately on click.
    moveBookmarks({ ids, targetWorkspaceId });
    if (!silent) {
      const workspaceName =
        workspaces.find((w) => w.id === targetWorkspaceId)?.name ||
        "Target Workspace";
      toast.success(
        ids.length === 1
          ? `Bookmark moved to ${workspaceName}`
          : `${ids.length} bookmarks moved to ${workspaceName}`,
      );
    }
    onSuccess();
    onOpenChange(false);
  };

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const triggerId = useId();

  return (
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
      <form onSubmit={handleMove} className="flex flex-col gap-2">
        <Label htmlFor={triggerId}>Target Workspace</Label>
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger
            id={triggerId}
            render={
              <Button
                variant="outline"
                className="w-full justify-between px-3 h-10 font-normal"
                disabled={availableWorkspaces.length === 0 || isPending}
              >
                <span className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: getPastelColor(
                        targetWorkspaceId || "default",
                      ),
                    }}
                  />
                  <span className="truncate">
                    {(targetWorkspaceId &&
                      workspaces.find((w) => w.id === targetWorkspaceId)
                        ?.name) ||
                      "Choose a workspace"}
                  </span>
                </span>
                <CaretUpDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              </Button>
            }
          />
          <DropdownMenuContent>
            <DropdownMenuGroup className="max-h-[30vh] overflow-y-auto overscroll-contain scroll-fade">
              <DropdownMenuLabel className="sr-only">
                Workspaces
              </DropdownMenuLabel>
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
                        className="w-2 h-2 rounded-full "
                        style={{ backgroundColor: getPastelColor(ws.id) }}
                      />
                      <span className="truncate">{ws.name}</span>
                    </div>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending || !targetWorkspaceId}>
            {isPending ? "Moving…" : "Move"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
