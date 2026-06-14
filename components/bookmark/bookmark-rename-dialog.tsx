"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { renameBookmark } from "~/app/action/bookmark.action";
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <RenameForm
          key={bookmark?.id ?? "none"}
          bookmark={bookmark}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
          onConfirm={onConfirm}
          silent={silent}
        />
      )}
    </Dialog>
  );
}

function RenameForm({
  bookmark,
  onOpenChange,
  onSuccess,
  onConfirm,
  silent,
}: Omit<BookmarkRenameDialogProps, "open">) {
  const [title, setTitle] = useState(bookmark?.title ?? "");
  const [isPending, startTransition] = useTransition();

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookmark || !title.trim() || title === bookmark.title) {
      onOpenChange(false);
      return;
    }
    startTransition(async () => {
      try {
        if (onConfirm) {
          await onConfirm(bookmark.id, title.trim());
          onSuccess();
          onOpenChange(false);
        } else {
          const res = await renameBookmark({
            id: bookmark.id,
            title: title.trim(),
          });
          if (res.success) {
            if (!silent) toast.success("Bookmark renamed");
            onSuccess();
            onOpenChange(false);
          } else {
            toast.error(res.error || "Failed to rename bookmark");
          }
        }
      } catch (_err) {
        toast.error("Failed to rename bookmark");
      }
    });
  };

  return (
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
  );
}
