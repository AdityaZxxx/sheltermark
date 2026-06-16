"use client";

import { WarningIcon } from "@phosphor-icons/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

interface WorkspaceRestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceName: string;
  bookmarkCount: number;
  hasDuplicateName: boolean;
  onConfirm: () => void;
}

export function WorkspaceRestoreDialog({
  open,
  onOpenChange,
  workspaceName,
  bookmarkCount,
  hasDuplicateName,
  onConfirm,
}: WorkspaceRestoreDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Restore workspace &ldquo;{workspaceName}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will restore the workspace and{" "}
            <span className="font-medium text-foreground">{bookmarkCount}</span>{" "}
            bookmark{bookmarkCount !== 1 ? "s" : ""} inside it.
          </AlertDialogDescription>
          {hasDuplicateName && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-amber-600 dark:text-amber-400">
              <WarningIcon className="size-4 mt-0.5 shrink-0" />
              <span className="text-sm">
                An active workspace with the same name already exists. Consider
                renaming it after restore.
              </span>
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Restore workspace
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
