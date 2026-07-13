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
import { useBookmarkMutations } from "~/hooks/use-bookmarks";

interface BookmarkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: string[];
  onSuccess: () => void;
  onConfirm?: (ids: string[]) => void | Promise<void>;
}

export function BookmarkDeleteDialog({
  open,
  onOpenChange,
  ids,
  onSuccess,
  onConfirm,
}: BookmarkDeleteDialogProps) {
  const { deleteBookmarks, isDeletingBookmarks } = useBookmarkMutations();

  const handleDelete = () => {
    if (ids.length === 0) return;

    if (onConfirm) {
      Promise.resolve(onConfirm(ids))
        .then(() => {
          onSuccess();
          onOpenChange(false);
        })
        .catch(() => {
          // optional error handling
        });
    } else {
      deleteBookmarks(
        { ids },
        {
          onSuccess: () => {
            onSuccess();
            onOpenChange(false);
          },
        },
      );
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {ids.length === 1
              ? "Trash Bookmark"
              : `Trash ${ids.length} Bookmarks`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Move {ids.length === 1 ? "this bookmark" : "these bookmarks"} to
            trash? You can restore them later from the Trash.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeletingBookmarks}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isDeletingBookmarks}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeletingBookmarks ? "Moving to trash..." : "Move to trash"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
