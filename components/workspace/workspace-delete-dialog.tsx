"use client";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface DeleteWorkspaceDialogProps {
  isOpen: boolean;
  isDeleting: boolean;
  workspaceName?: string;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  isDefault?: boolean;
}

export function WorkspaceDeleteDialog({
  isOpen,
  isDeleting,
  workspaceName,
  error,
  onOpenChange,
  onConfirm,
  isDefault,
}: DeleteWorkspaceDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isDefault ? "Can’t delete workspace" : "Trash workspace"}
          </DialogTitle>

          <DialogDescription>
            {isDefault ? (
              <>
                <span className="font-medium text-foreground">
                  “{workspaceName}”
                </span>{" "}
                is your default workspace. Set another workspace as default if
                you want to delete this one.
              </>
            ) : (
              <>
                Move{" "}
                <span className="font-medium text-foreground">
                  “{workspaceName}”
                </span>{" "}
                to trash? All bookmarks in this workspace will also be moved to
                trash. You can restore them later.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {error && !isDefault && (
          <p className="text-sm text-destructive">
            Something went wrong. Please try again.
          </p>
        )}

        <DialogFooter className="flex flex-row justify-end ">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            {isDefault ? "Got it" : "Cancel"}
          </Button>

          {!isDefault && (
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Moving to trash…" : "Move to trash"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
