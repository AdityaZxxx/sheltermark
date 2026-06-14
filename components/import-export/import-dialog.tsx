"use client";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import { useImportDialog } from "~/hooks/use-import-dialog";
import { DoneStep } from "./done-step";
import { ImportingStep } from "./importing-step";
import { PreviewStep } from "./preview-step";
import { UploadStep } from "./upload-step";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const {
    step,
    file,
    preview,
    progress,
    result,
    targetWorkspaceId,
    newWorkspaceName,
    duplicateStrategy,
    isCheckingDuplicates,
    isNewWorkspace,
    fileInputRef,
    handleFileChange,
    handleImport,
    handleClose,
    goBack,
    setTargetWorkspaceId,
    setNewWorkspaceName,
    setDuplicateStrategy,
  } = useImportDialog();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[95vh]">
        <DialogHeader>
          <DialogTitle>Import Bookmarks</DialogTitle>
          <DialogDescription>
            Import bookmarks from a JSON or CSV file.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <UploadStep
            file={file}
            fileInputRef={fileInputRef}
            onFileChange={handleFileChange}
          />
        )}

        {step === "preview" && preview && (
          <PreviewStep
            preview={preview}
            isCheckingDuplicates={isCheckingDuplicates}
            targetWorkspaceId={targetWorkspaceId}
            newWorkspaceName={newWorkspaceName}
            duplicateStrategy={duplicateStrategy}
            isNewWorkspace={isNewWorkspace}
            onWorkspaceChange={(value) => setTargetWorkspaceId(value as string)}
            onWorkspaceNameChange={setNewWorkspaceName}
            onDuplicateStrategyChange={setDuplicateStrategy}
          />
        )}

        {step === "importing" && <ImportingStep progress={progress} />}

        {step === "done" && result && <DoneStep result={result} />}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={goBack}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={isNewWorkspace ? !newWorkspaceName.trim() : false}
              >
                Import
              </Button>
            </>
          )}

          {step === "done" && (
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
