"use client";

import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useWorkspaces } from "~/hooks/use-workspaces";
import { cn, getPastelColor } from "~/lib/utils";

interface RestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmarkCount: number;
  hasTrashedOrigin: boolean;
  trashedWorkspaceName?: string | null;
  originalWorkspaceName?: string | null;
  onRestoreWorkspace?: () => void;
  isRestoringWorkspace?: boolean;
  onConfirm: (options: {
    targetWorkspaceId?: string | null;
    newWorkspaceName?: string;
  }) => void;
}

type Destination = "original" | "other" | "new";

export function RestoreDialog({
  open,
  onOpenChange,
  bookmarkCount,
  hasTrashedOrigin,
  trashedWorkspaceName,
  originalWorkspaceName,
  onRestoreWorkspace,
  isRestoringWorkspace,
  onConfirm,
}: RestoreDialogProps) {
  const { workspaces } = useWorkspaces();

  const originalWs = useMemo(
    () =>
      originalWorkspaceName
        ? (workspaces.find((ws) => ws.name === originalWorkspaceName) ?? null)
        : null,
    [originalWorkspaceName, workspaces],
  );

  const workspaceItems = useMemo(
    () => workspaces.map((ws) => ({ value: ws.id, label: ws.name })),
    [workspaces],
  );

  const [destination, setDestination] = useState<Destination>("other");
  const [selectedWsId, setSelectedWsId] = useState("");
  const [newWsName, setNewWsName] = useState("Restored");

  useEffect(() => {
    if (!open) return;
    setDestination(
      hasTrashedOrigin ? "other" : originalWs ? "original" : "other",
    );
    setSelectedWsId(workspaces[0]?.id ?? "");
    setNewWsName("Restored");
  }, [open, hasTrashedOrigin, originalWs, workspaces]);

  const handleConfirm = () => {
    if (destination === "new") {
      onConfirm({ newWorkspaceName: newWsName });
    } else if (destination === "original") {
      onConfirm({});
    } else {
      onConfirm({ targetWorkspaceId: selectedWsId });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Restore {bookmarkCount} bookmark
            {bookmarkCount !== 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            Choose where to restore {bookmarkCount === 1 ? "this" : "these"}{" "}
            bookmark
            {bookmarkCount !== 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>

        {hasTrashedOrigin && trashedWorkspaceName && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Original workspace is in Trash
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              &ldquo;{trashedWorkspaceName}&rdquo; is in the trash. Restore it
              first, or choose a different destination below.
            </p>
            {onRestoreWorkspace && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={isRestoringWorkspace}
                onClick={onRestoreWorkspace}
              >
                <ArrowCounterClockwiseIcon className="size-3 mr-1.5" />
                {isRestoringWorkspace ? "Restoring\u2026" : "Restore workspace"}
              </Button>
            )}
          </div>
        )}

        <RadioGroup
          value={destination}
          onValueChange={(v) => setDestination(v as Destination)}
          className="gap-2"
        >
          {!hasTrashedOrigin && (originalWs || originalWorkspaceName) && (
            <Row
              selected={destination === "original"}
              onClick={() => setDestination("original")}
            >
              <RadioGroupItem value="original" />
              <div>
                <p className="text-sm font-medium">Original workspace</p>
                <p className="text-sm text-muted-foreground">
                  {originalWs?.name ?? originalWorkspaceName}
                </p>
              </div>
            </Row>
          )}

          <Row
            selected={destination === "other"}
            onClick={() => setDestination("other")}
          >
            <RadioGroupItem value="other" />
            <div className="flex-1">
              <p className="text-sm font-medium">Other workspace</p>
              {destination === "other" && (
                // biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only; keyboard irrelevant for this wrapper
                // biome-ignore lint/a11y/noStaticElementInteractions: prevents Select click from toggling radio parent
                <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={selectedWsId}
                    onValueChange={(v) => {
                      if (v) setSelectedWsId(v);
                    }}
                    items={workspaceItems}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a workspace">
                        {(value: string | null) => {
                          if (!value) return null;
                          const ws = workspaces.find((w) => w.id === value);
                          if (!ws) return null;
                          return (
                            <div className="flex items-center gap-2">
                              <div
                                className="size-2 rounded-full"
                                style={{
                                  backgroundColor: getPastelColor(ws.id),
                                }}
                              />
                              <span className="truncate">{ws.name}</span>
                            </div>
                          );
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {workspaces.map((ws) => (
                        <SelectItem key={ws.id} value={ws.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="size-2 rounded-full"
                              style={{
                                backgroundColor: getPastelColor(ws.id),
                              }}
                            />
                            <span className="truncate">{ws.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </Row>

          <Row
            selected={destination === "new"}
            onClick={() => setDestination("new")}
          >
            <RadioGroupItem value="new" />
            <div className="flex-1">
              <p className="text-sm font-medium">New workspace</p>
              {destination === "new" && (
                <Input
                  className="mt-2"
                  placeholder="Workspace name"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  maxLength={35}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          </Row>
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              (destination === "new" && !newWsName.trim()) ||
              (destination === "other" && !selectedWsId)
            }
          >
            Restore
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: row toggles radio for convenience; keyboard handled by RadioGroupItem natively
    // biome-ignore lint/a11y/noStaticElementInteractions: RadioGroupItem inside provides the interactive radio element
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 transition-colors cursor-pointer",
        selected && "border-primary bg-accent",
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
