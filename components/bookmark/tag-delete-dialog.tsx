"use client";

import type { TagWithCount } from "~/lib/schemas/tag.schema";

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
import { formatCount } from "~/lib/utils";

interface TagDeleteDialogProps {
  tag: TagWithCount | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (tagId: string) => void;
  isPending: boolean;
}

export function TagDeleteDialog({
  tag,
  onOpenChange,
  onConfirm,
  isPending,
}: TagDeleteDialogProps) {
  return (
    <AlertDialog open={tag !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete tag</AlertDialogTitle>
          <AlertDialogDescription>
            {tag && (
              <>
                <span className="font-medium text-foreground">#{tag.name}</span>{" "}
                is used on{" "}
                {tag.count === 0
                  ? "your tags"
                  : formatCount(tag.count, "bookmark")}
                . This will remove the tag from all bookmarks.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} variant="outline">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => tag && onConfirm(tag.id)}
            disabled={isPending}
            variant="destructive"
          >
            {isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
