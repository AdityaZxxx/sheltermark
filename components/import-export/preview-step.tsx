"use client";

import {
  ArrowsLeftRightIcon,
  CopySimpleIcon,
  FilesIcon,
  FolderSimpleIcon,
  SkipForwardIcon,
  SpinnerIcon,
} from "@phosphor-icons/react";

import type { PreviewData } from "~/hooks/use-import-dialog";
import type { FolderNode } from "~/lib/import/folder-filter";

import {
  Field,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { RadioGroup } from "~/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useWorkspaces } from "~/hooks/use-workspaces";
import { getPastelColor } from "~/lib/utils";

import { FolderTree } from "./folder-tree";
import { RadioCard } from "./radio-card";

interface PreviewStepProps {
  preview: PreviewData;
  fileTotal: number;
  isCheckingDuplicates: boolean;
  targetWorkspaceId: string | "new";
  newWorkspaceName: string;
  duplicateStrategy: "skip" | "replace";
  isNewWorkspace: boolean;
  isNetscape: boolean;
  folderTree: FolderNode[];
  selectedFolders: Set<string>;
  selectedCount: number;
  onWorkspaceChange: (value: string | null) => void;
  onWorkspaceNameChange: (value: string) => void;
  onDuplicateStrategyChange: (value: "skip" | "replace") => void;
  onToggleFolder: (path: string[]) => void;
}

export function PreviewStep({
  preview,
  fileTotal,
  isCheckingDuplicates,
  targetWorkspaceId,
  newWorkspaceName,
  duplicateStrategy,
  isNewWorkspace,
  isNetscape,
  folderTree,
  selectedFolders,
  selectedCount,
  onWorkspaceChange,
  onWorkspaceNameChange,
  onDuplicateStrategyChange,
  onToggleFolder,
}: PreviewStepProps) {
  const { workspaces } = useWorkspaces();
  const nameInvalid = isNewWorkspace && !newWorkspaceName.trim();
  // New workspaces start empty — no duplicate check runs, so derive 0
  // instead of showing a stale count from a previously selected workspace.
  const duplicates = isNewWorkspace ? 0 : preview.duplicates;

  return (
    <div className="flex flex-col gap-5 py-2">
      <dl className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
          <dt className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
            <FilesIcon className="size-3.5 shrink-0" aria-hidden="true" />
            Found
          </dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums">
            {fileTotal}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
          <dt className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
            <FolderSimpleIcon
              className="size-3.5 shrink-0"
              aria-hidden="true"
            />
            Selected
          </dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums">
            {isNetscape ? selectedCount : preview.validBookmarks}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
          <dt className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CopySimpleIcon className="size-3.5 shrink-0" aria-hidden="true" />
            Duplicates
          </dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums">
            {isCheckingDuplicates ? (
              <SpinnerIcon
                className="mx-auto size-4.5 motion-safe:animate-spin"
                aria-label="Checking duplicates"
              />
            ) : (
              duplicates
            )}
          </dd>
        </div>
      </dl>

      {isNetscape && folderTree.length > 0 && (
        <FieldSet className="gap-3">
          <FieldLegend variant="label">Folders to import</FieldLegend>
          <FolderTree
            folders={folderTree}
            selectedFolders={selectedFolders}
            selectedCount={selectedCount}
            totalCount={fileTotal}
            onToggle={onToggleFolder}
          />
        </FieldSet>
      )}

      <FieldSet className="gap-3">
        <FieldLegend variant="label">Import to workspace</FieldLegend>
        <Select
          id="import-workspace-select"
          value={targetWorkspaceId}
          onValueChange={onWorkspaceChange}
        >
          <SelectTrigger aria-label="Import to workspace" className="w-full">
            <SelectValue>
              {isNewWorkspace ? (
                "+ New workspace"
              ) : (
                <span className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: getPastelColor(targetWorkspaceId),
                    }}
                  />
                  <span className="truncate">
                    {workspaces.find((ws) => ws.id === targetWorkspaceId)?.name}
                  </span>
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">+ New workspace</SelectItem>
            {workspaces.map((ws) => (
              <SelectItem key={ws.id} value={ws.id}>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: getPastelColor(ws.id) }}
                  />
                  <span className="truncate">{ws.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isNewWorkspace && (
          <Field>
            <FieldLabel htmlFor="import-workspace-name">
              Workspace name
            </FieldLabel>
            <Input
              id="import-workspace-name"
              type="text"
              placeholder="Imported bookmarks"
              value={newWorkspaceName}
              onChange={(e) => onWorkspaceNameChange(e.target.value)}
              aria-invalid={nameInvalid}
              aria-describedby={
                nameInvalid ? "import-workspace-name-error" : undefined
              }
              maxLength={35}
            />
            <FieldError
              id="import-workspace-name-error"
              errors={
                nameInvalid
                  ? [{ message: "Workspace name is required." }]
                  : undefined
              }
            />
          </Field>
        )}
      </FieldSet>

      {!isNewWorkspace && duplicates > 0 ? (
        <FieldSet className="gap-3">
          <FieldLegend variant="label">Duplicate handling</FieldLegend>
          <RadioGroup
            value={duplicateStrategy}
            onValueChange={(value) => {
              if (value === "skip" || value === "replace") {
                onDuplicateStrategyChange(value);
              }
            }}
            className="grid gap-2"
          >
            <RadioCard
              id="dup-skip"
              value="skip"
              title="Skip duplicates"
              description="Keep existing bookmarks, import only new URLs."
              icon={<SkipForwardIcon className="size-4" aria-hidden="true" />}
            />
            <RadioCard
              id="dup-replace"
              value="replace"
              title="Replace duplicates"
              description="Overwrite matching URLs with the imported version."
              icon={
                <ArrowsLeftRightIcon className="size-4" aria-hidden="true" />
              }
            />
          </RadioGroup>
        </FieldSet>
      ) : null}
    </div>
  );
}
