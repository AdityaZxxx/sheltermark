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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useWorkspaces } from "~/hooks/use-workspaces";
import { getPastelColor } from "~/lib/utils";

interface RestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmarkCount: number;
  hasTrashedOrigin: boolean;
  onConfirm: (options: {
    targetWorkspaceId?: string | null;
    newWorkspaceName?: string;
  }) => void;
}

export function RestoreDialog({
  open,
  onOpenChange,
  bookmarkCount,
  hasTrashedOrigin,
  onConfirm,
}: RestoreDialogProps) {
  const { workspaces } = useWorkspaces();
  const [selection, setSelection] = useState<string | "original" | "new">(
    hasTrashedOrigin ? "new" : "original",
  );
  const [newName, setNewName] = useState("Restored");

  const isNewWorkspace = selection === "new";

  const handleConfirm = () => {
    if (selection === "new") {
      onConfirm({ newWorkspaceName: newName });
    } else if (selection === "original") {
      onConfirm({});
    } else {
      onConfirm({ targetWorkspaceId: selection });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Restore {bookmarkCount} bookmark{bookmarkCount !== 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            {hasTrashedOrigin
              ? "The original workspace is in the trash. Choose a destination for the restored bookmark" +
                (bookmarkCount !== 1 ? "s" : "") +
                "."
              : "Choose where to restore " +
                (bookmarkCount === 1 ? "this" : "these") +
                " bookmark" +
                (bookmarkCount !== 1 ? "s" : "") +
                "."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-3">
            <Label className="text-xs font-medium">Restore to workspace</Label>
            <Select
              value={selection}
              onValueChange={(val) =>
                setSelection(val as string | "original" | "new")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {selection === "new" ? (
                    "+ New workspace"
                  ) : selection === "original" ? (
                    "Original workspace"
                  ) : (
                    <div className="flex items-center gap-2">
                      <div
                        className="size-2 rounded-full"
                        style={{
                          backgroundColor: getPastelColor(selection),
                        }}
                      />
                      <span className="truncate">
                        {workspaces.find((ws) => ws.id === selection)?.name}
                      </span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {!hasTrashedOrigin && (
                  <SelectItem value="original">Original workspace</SelectItem>
                )}
                <SelectItem value="new">+ New workspace</SelectItem>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="size-2 rounded-full"
                        style={{ backgroundColor: getPastelColor(ws.id) }}
                      />
                      <span className="truncate">{ws.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isNewWorkspace && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Workspace name</Label>
              <Input
                type="text"
                placeholder="Workspace name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={35}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isNewWorkspace && !newName.trim()}
          >
            Restore
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
