"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deleteBookmarks } from "~/app/action/bookmark";
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
}

export function BookmarkDeleteDialog({
  open,
  onOpenChange,
  ids,
  onSuccess,
}: BookmarkDeleteDialogProps) {
  const [isPending, setIsPending] = useState(false);

  const handleDelete = async () => {
    if (ids.length === 0) return;

    setIsPending(true);
    const res = await deleteBookmarks(ids);
    setIsPending(false);

    if (res.success) {
      toast.success(
        ids.length === 1
          ? "Bookmark deleted"
          : `${ids.length} bookmarks deleted`,
      );
      onSuccess();
      onOpenChange(false);
    } else {
      toast.error(res.error || "Failed to delete bookmarks");
    }
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
