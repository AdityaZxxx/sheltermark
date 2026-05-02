"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteBookmarks } from "~/app/action/bookmark.action";
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

interface BookmarkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: string[];
  onSuccess: () => void;
  onConfirm?: (ids: string[]) => void | Promise<void>;
  silent?: boolean;
}

export function BookmarkDeleteDialog({
  open,
  onOpenChange,
  ids,
  onSuccess,
  onConfirm,
  silent = false,
}: BookmarkDeleteDialogProps) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (ids.length === 0) return;

    startTransition(async () => {
      try {
        if (onConfirm) {
          await onConfirm(ids);
        } else {
          const res = await deleteBookmarks({ ids });
          if (res.success) {
            if (!silent) {
              toast.success(
                ids.length === 1
                  ? "Bookmark deleted"
                  : `${ids.length} bookmarks deleted`,
              );
            }
          } else {
            toast.error(res.error || "Failed to delete bookmarks");
          }
        }
        onSuccess();
        onOpenChange(false);
      } catch {
        toast.error("Failed to delete bookmarks");
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {ids.length === 1
              ? "Delete Bookmark"
              : `Delete ${ids.length} Bookmarks`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            {ids.length === 1 ? "this bookmark" : "these bookmarks"}? This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
