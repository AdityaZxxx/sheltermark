"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (isOpen) setName(currentName);
  }, [isOpen, currentName]);

  const handleOpenChange = (open: boolean) => {
    if (!open) setName(currentName);
    onOpenChange(open);
  };

  const handleSubmit = () => {
    if (name.trim() && name.trim() !== currentName) {
      onRename(name.trim());
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Workspace</DialogTitle>
          <DialogDescription>Give your workspace a new name.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="workspace-name">Name</Label>
            <Input
              id="workspace-name"
              placeholder="Enter workspace name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              maxLength={35}
            />
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-end ">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || name.trim() === currentName || isRenaming}
          >
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
