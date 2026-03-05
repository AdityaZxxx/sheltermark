"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { renameBookmark } from "~/app/action/bookmark";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

interface BookmarkRenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmark: { id: string; title: string } | null;
  onSuccess: () => void;
  onConfirm?: (id: string, title: string) => void | Promise<void>;
  silent?: boolean;
}

export function BookmarkRenameDialog({
  open,
  onOpenChange,
  bookmark,
  onSuccess,
  onConfirm,
  silent = false,
}: BookmarkRenameDialogProps) {
  const [title, setTitle] = useState("");
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (bookmark) {
      setTitle(bookmark.title);
    }
  }, [bookmark]);

  const handleRename = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!bookmark || !title.trim() || title === bookmark.title) {
      onOpenChange(false);
      return;
    }

    setIsPending(true);

    if (onConfirm) {
      await onConfirm(bookmark.id, title.trim());
      setIsPending(false);
      onSuccess();
      onOpenChange(false);
    } else {
      const res = await renameBookmark(bookmark.id, title.trim());
      setIsPending(false);

      if (res.success) {
        if (!silent) toast.success("Bookmark renamed");
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(res.error || "Failed to rename bookmark");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Bookmark</DialogTitle>
          <DialogDescription>
            Enter a new title for this bookmark.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleRename} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bookmark title"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Renaming..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
