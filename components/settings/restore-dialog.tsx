"use client";

import { FileIcon, SpinnerIcon, WarningIcon } from "@phosphor-icons/react";
import { useState } from "react";

import type { BackupFileMeta } from "~/lib/backup/service";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Field, FieldLabel } from "~/components/ui/field";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
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

  const { data: files, isLoading: isLoadingFiles } = useBackupFiles(open);
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Restore from Backup</DialogTitle>
          <DialogDescription>
            Restore bookmarks from a file in your cloud backup folder.
          </DialogDescription>
        </DialogHeader>

        {step === "list" && (
          <div className="max-h-72 overflow-y-auto">
            {isLoadingFiles ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                <SpinnerIcon className="mr-1 inline size-4 animate-spin" />
                Loading backups…
              </p>
            ) : backups.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No backups found yet. Run Back Up Now first.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {backups.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectFile(file)}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted"
                    >
                      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {file.name}
                      </span>
                      {file.modifiedTime && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(file.modifiedTime).toLocaleDateString()}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === "confirm" && selectedFile && (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border p-3">
              <p className="text-sm font-medium">{selectedFile.name}</p>
              {previewMutation.isPending ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  <SpinnerIcon className="mr-1 inline size-4 animate-spin" />
                  Reading backup…
                </p>
              ) : previewMutation.data ? (
                <div className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground">
                  <p>
                    {previewMutation.data.totalBookmarks} bookmarks across{" "}
                    {previewMutation.data.workspaces.length} workspace(s)
                  </p>
                  <ul className="list-inside list-disc">
                    {previewMutation.data.workspaces.map((ws) => (
                      <li key={ws.name}>
                        {ws.name}: {ws.count}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  Could not read this backup.
                </p>
              )}
            </div>

            <Field>
              <FieldLabel>Existing bookmarks</FieldLabel>
              <RadioGroup
                value={duplicateStrategy}
                onValueChange={handleDuplicateStrategyChange}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="skip" id="restore-skip" />
                  <label htmlFor="restore-skip" className="text-sm">
                    Keep mine — skip duplicates
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="replace" id="restore-replace" />
                  <label htmlFor="restore-replace" className="text-sm">
                    Replace — backup wins for duplicates
                  </label>
                </div>
              </RadioGroup>
            </Field>

            {duplicateStrategy === "replace" && (
              <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                <WarningIcon className="mt-0.5 size-4 shrink-0" />
                Replace deletes your current bookmark for a duplicate URL in the
                target workspace, then inserts the backup&apos;s version.
              </p>
            )}
          </div>
        )}

        {step === "restoring" && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            <SpinnerIcon className="mr-1 inline size-4 animate-spin" />
            Restoring bookmarks…
          </p>
        )}

        <DialogFooter>
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
      </DialogContent>
    </Dialog>
  );
}
