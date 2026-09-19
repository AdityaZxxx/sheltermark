"use client";

import {
  ArrowsLeftRightIcon,
  FileIcon,
  SkipForwardIcon,
  SpinnerIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

import type { BackupFileMeta } from "~/lib/backup/service";

import { RadioCard } from "~/components/import-export/radio-card";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { FieldLegend, FieldSet } from "~/components/ui/field";
import { RadioGroup } from "~/components/ui/radio-group";
import {
  usePreviewRestore,
  useRestoreBackup,
} from "~/lib/mutations/backup.mutations";
import { useBackupFiles } from "~/lib/queries/backup.queries";

type RestoreStep = "list" | "confirm" | "restoring";

interface RestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RestoreDialog({ open, onOpenChange }: RestoreDialogProps) {
  const [step, setStep] = useState<RestoreStep>("list");
  const [selectedFile, setSelectedFile] = useState<BackupFileMeta | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<
    "skip" | "replace"
  >("skip");

  const {
    data: files,
    isLoading: isLoadingFiles,
    isError: isFilesError,
  } = useBackupFiles(open);
  const previewMutation = usePreviewRestore();
  const restoreMutation = useRestoreBackup();

  const handleClose = () => {
    setStep("list");
    setSelectedFile(null);
    setDuplicateStrategy("skip");
    previewMutation.reset();
    restoreMutation.reset();
    onOpenChange(false);
  };

  const handleSelectFile = (file: BackupFileMeta) => {
    setSelectedFile(file);
    previewMutation.mutate(file.id);
    setStep("confirm");
  };

  const handleRestore = () => {
    if (!selectedFile) return;
    setStep("restoring");
    restoreMutation.mutate(
      { fileId: selectedFile.id, duplicateStrategy },
      {
        onSuccess: () => handleClose(),
        onError: () => setStep("confirm"),
      },
    );
  };

  const handleDuplicateStrategyChange = (value: string) => {
    // RadioGroup yields string; the two rendered options are the only values.
    // SAFETY: value comes from the two RadioGroupItems rendered above.
    if (value === "skip" || value === "replace") {
      setDuplicateStrategy(value);
    }
  };

  const backups = files ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}
    >
      <DialogContent className="flex max-h-[90vh] min-h-80 flex-col gap-0 overflow-hidden p-0 sm:min-w-md sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 pt-5 pb-4">
          <DialogTitle>Restore from backup</DialogTitle>
          <DialogDescription>
            {step === "list" &&
              "Restore bookmarks from a file in your Sheltermark/Backups folder."}
            {step === "confirm" &&
              "Review what's in this backup, then choose how duplicates are handled."}
            {step === "restoring" && "Writing bookmarks to your workspaces…"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === "list" &&
            (isLoadingFiles ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <SpinnerIcon
                    className="size-6 motion-safe:animate-spin"
                    aria-label="Loading backups"
                  />
                </span>
                <p className="text-sm text-muted-foreground">
                  Loading backups…
                </p>
              </div>
            ) : isFilesError ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Unable to load backups. Reconnect the provider in Settings, then
                try again.
              </p>
            ) : backups.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No backups yet. Back up first, then restore here.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {backups.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectFile(file)}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/50"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <FileIcon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {file.name}
                        </span>
                        {file.modifiedTime && (
                          <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                            {new Date(file.modifiedTime).toLocaleDateString()}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ))}

          {step === "confirm" && selectedFile && (
            <div className="flex flex-col gap-5 py-2">
              <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileIcon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium"
                      title={selectedFile.name}
                    >
                      {selectedFile.name}
                    </p>
                    {previewMutation.isPending ? (
                      <p
                        aria-live="polite"
                        className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <SpinnerIcon
                          className="size-3.5 motion-safe:animate-spin"
                          aria-label="Reading backup"
                        />
                        Reading backup…
                      </p>
                    ) : previewMutation.data ? (
                      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                        {previewMutation.data.totalBookmarks} bookmarks across{" "}
                        {previewMutation.data.workspaces.length}{" "}
                        {previewMutation.data.workspaces.length === 1
                          ? "workspace"
                          : "workspaces"}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Unable to read this backup. Choose another file.
                      </p>
                    )}
                  </div>
                </div>

                {previewMutation.data && (
                  <ul className="flex flex-col gap-1 border-t border-border pt-2.5">
                    {previewMutation.data.workspaces.map((ws) => (
                      <li
                        key={ws.name}
                        className="flex min-w-0 items-center justify-between gap-3"
                      >
                        <span
                          className="min-w-0 truncate text-xs text-muted-foreground"
                          title={ws.name}
                        >
                          {ws.name}
                        </span>
                        <span className="shrink-0 pl-2 text-xs text-muted-foreground tabular-nums">
                          {ws.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <FieldSet className="gap-3">
                <FieldLegend variant="label">Duplicate handling</FieldLegend>
                <RadioGroup
                  value={duplicateStrategy}
                  onValueChange={handleDuplicateStrategyChange}
                  className="grid gap-2"
                >
                  <RadioCard
                    id="restore-dup-skip"
                    value="skip"
                    title="Skip duplicates"
                    description="Keep existing bookmarks, restore only new URLs."
                    icon={
                      <SkipForwardIcon className="size-4" aria-hidden="true" />
                    }
                  />
                  <RadioCard
                    id="restore-dup-replace"
                    value="replace"
                    title="Replace duplicates"
                    description="Overwrite matching URLs with the backup's version."
                    icon={
                      <ArrowsLeftRightIcon
                        className="size-4"
                        aria-hidden="true"
                      />
                    }
                  />
                </RadioGroup>
              </FieldSet>

              {duplicateStrategy === "replace" && (
                <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  <WarningIcon
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  Restoring with replace deletes a current bookmark when the
                  backup holds the same URL, then inserts the backup's version.
                </p>
              )}
            </div>
          )}

          {step === "restoring" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <SpinnerIcon
                  className="size-6 motion-safe:animate-spin"
                  aria-hidden="true"
                />
              </span>
              <p aria-live="polite" className="text-sm font-medium">
                Restoring bookmarks…
              </p>
            </div>
          )}
        </div>

        {step !== "restoring" && (
          <DialogFooter className="flex-row justify-end border-t border-border px-5 py-4">
            {step === "list" && (
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            )}
            {step === "confirm" && (
              <>
                <Button variant="outline" onClick={() => setStep("list")}>
                  Back
                </Button>
                <Button
                  onClick={handleRestore}
                  disabled={previewMutation.isPending}
                >
                  Restore
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
