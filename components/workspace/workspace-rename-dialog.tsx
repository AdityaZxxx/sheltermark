"use client";

import { useState } from "react";

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

interface WorkspaceRenameDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onRename: (name: string) => void;
  isRenaming?: boolean;
}

export function WorkspaceRenameDialog({
  isOpen,
  onOpenChange,
  currentName,
  onRename,
  isRenaming,
}: WorkspaceRenameDialogProps) {
  const [name, setName] = useState(currentName);
  const [prevOpen, setPrevOpen] = useState(isOpen);

  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) setName(currentName);
  }

  const trimmedName = name.trim();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmedName || trimmedName === currentName) return;

    onRename(trimmedName);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Workspace</DialogTitle>
          <DialogDescription>Give your workspace a new name.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="workspace-name">Name</Label>
            <Input
              id="workspace-name"
              placeholder="e.g. Research, Design, Inbox"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={35}
            />
          </div>

          <DialogFooter className="flex flex-row justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !trimmedName || trimmedName === currentName || isRenaming
              }
            >
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
