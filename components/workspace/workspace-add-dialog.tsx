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

export function WorkspaceAddDialog({
  isOpen,
  onOpenChange,
  onAdd,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) return;

    onAdd(trimmedName);
    setName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Workspace</DialogTitle>
          <DialogDescription>
            Workspaces keep your bookmarks, tags, and shared links separate.
          </DialogDescription>
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
            <Button type="submit" disabled={!name.trim()}>
              Add Workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
