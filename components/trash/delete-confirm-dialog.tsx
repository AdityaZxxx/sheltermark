"use client";

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

export type PendingDelete =
  | { kind: "bookmark"; ids: string[] }
  | {
      kind: "workspace";
      id: string;
      name: string;
      bookmarkCount: number;
    }
  | null;

export function DeleteConfirmDialog({
  pendingDelete,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  pendingDelete: PendingDelete;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}) {
  return (
    <AlertDialog open={pendingDelete !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {pendingDelete?.kind === "workspace"
              ? `Delete workspace "${pendingDelete.name}"?`
              : `Delete ${pendingDelete?.ids.length ?? 0} bookmark${(pendingDelete?.ids.length ?? 0) > 1 ? "s" : ""}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pendingDelete?.kind === "workspace" ? (
              <>
                Permanently delete{" "}
                <span className="font-medium text-foreground">
                  {pendingDelete.bookmarkCount}
                </span>{" "}
                bookmark{pendingDelete.bookmarkCount !== 1 ? "s" : ""} inside
                it. This action cannot be undone.
              </>
            ) : (
              "This action cannot be undone."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Deleting…" : "Delete forever"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
