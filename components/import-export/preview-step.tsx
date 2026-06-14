"use client";

import { SpinnerIcon } from "@phosphor-icons/react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { PreviewData } from "~/hooks/use-import-dialog";
import { useWorkspaces } from "~/hooks/use-workspaces";
import { cn, getPastelColor } from "~/lib/utils";

interface PreviewStepProps {
  preview: PreviewData;
  isCheckingDuplicates: boolean;
  targetWorkspaceId: string | "new";
  newWorkspaceName: string;
  duplicateStrategy: "skip" | "replace";
  isNewWorkspace: boolean;
  onWorkspaceChange: (value: string | null) => void;
  onWorkspaceNameChange: (value: string) => void;
  onDuplicateStrategyChange: (value: "skip" | "replace") => void;
}

export function PreviewStep({
  preview,
  isCheckingDuplicates,
  targetWorkspaceId,
  newWorkspaceName,
  duplicateStrategy,
  isNewWorkspace,
  onWorkspaceChange,
  onWorkspaceNameChange,
  onDuplicateStrategyChange,
}: PreviewStepProps) {
  const { workspaces } = useWorkspaces();

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total bookmarks</span>
          <span className="font-medium">{preview.totalBookmarks}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Potential duplicates</span>
          <span className="font-medium">
            {isCheckingDuplicates ? (
              <SpinnerIcon className="animate-spin" />
            ) : (
              preview.duplicates
            )}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Workspaces in file</span>
          <span className="font-medium">{preview.workspaces.length}</span>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-xs font-medium">Import to workspace</Label>
        <Select value={targetWorkspaceId} onValueChange={onWorkspaceChange}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {isNewWorkspace ? (
                "+  New workspace"
              ) : (
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: getPastelColor(targetWorkspaceId),
                    }}
                  />
                  <span className="truncate">
                    {workspaces.find((ws) => ws.id === targetWorkspaceId)?.name}
                  </span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">+ New workspace</SelectItem>
            {workspaces.map((ws) => (
              <SelectItem key={ws.id} value={ws.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getPastelColor(ws.id) }}
                  />
                  <span className="truncate">{ws.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isNewWorkspace && (
          <>
            <Label className="text-xs font-medium">Workspace name</Label>
            <Input
              type="text"
              placeholder="Workspace name"
              value={newWorkspaceName}
              onChange={(e) => onWorkspaceNameChange(e.target.value)}
              className="mt-2"
            />
          </>
        )}
      </div>

      <div className={cn("space-y-3 block", isNewWorkspace && "hidden")}>
        <Label className="text-xs font-medium">Duplicate handling</Label>
        <RadioGroup
          value={duplicateStrategy}
          onValueChange={(value) =>
            onDuplicateStrategyChange(value as "skip" | "replace")
          }
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="skip" id="dup-skip" />
            <Label htmlFor="dup-skip" className="font-normal cursor-pointer">
              Skip duplicates
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="replace" id="dup-replace" />
            <Label htmlFor="dup-replace" className="font-normal cursor-pointer">
              Replace duplicates
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
