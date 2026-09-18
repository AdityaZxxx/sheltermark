"use client";

import { useEffect } from "react";

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
    fileType,
    detectedFormat,
    preview,
    progress,
    targetWorkspaceId,
    newWorkspaceName,
    duplicateStrategy,
    result,
    isCheckingDuplicates,
    isParsing,
    isNewWorkspace,
    parseError,
    parsedBookmarks,
    folderTree,
    selectedFolders,
    selectedCount,
    fileInputRef,
    handleFileChange,
    handleFileSelect,
    handleImport,
    resetState,
    goBack,
    clearFile,
    setTargetWorkspaceId,
    setNewWorkspaceName,
    setDuplicateStrategy,
    toggleFolder,
  } = useImportDialog();

  useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  const close = () => onOpenChange(false);
  const isNetscape = fileType === "netscape";
  const nothingSelected = isNetscape && selectedCount === 0;
  const nameMissing = isNewWorkspace && !newWorkspaceName.trim();
  // The button names the consequence: under Skip replaced duplicates never
  // land (count is post-skip); under Replace they are overwritten in place,
  // so every selected bookmark lands. Import is disabled while the check
  // runs, so this count is never computed from stale data.
  const duplicates = isNewWorkspace ? 0 : (preview?.duplicates ?? 0);
  const willImport =
    duplicateStrategy === "skip"
      ? Math.max(0, selectedCount - duplicates)
      : selectedCount;
  const importDisabled =
    nothingSelected || nameMissing || isCheckingDuplicates || willImport === 0;

  const importLabel = nothingSelected
    ? "Select folders to continue"
    : willImport === 0
      ? "Nothing to import"
      : `Import ${willImport}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 pt-5 pb-4">
          <DialogTitle>Import Bookmarks</DialogTitle>
          <DialogDescription>
            {step === "upload" &&
              "Bring bookmarks from your browser or a Sheltermark backup."}
            {step === "preview" &&
              "Review what was found, then choose where it goes."}
            {step === "importing" && "Writing bookmarks to your workspace…"}
            {step === "done" && "Your bookmarks are ready."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === "upload" && (
            <UploadStep
              file={file}
              fileInputRef={fileInputRef}
              detectedFormat={detectedFormat}
              isParsing={isParsing}
              error={parseError}
              onFileChange={handleFileChange}
              onFileSelect={handleFileSelect}
              onClearFile={clearFile}
            />
          )}

          {step === "preview" && preview && (
            <PreviewStep
              preview={preview}
              fileTotal={parsedBookmarks.length}
              isCheckingDuplicates={isCheckingDuplicates}
              targetWorkspaceId={targetWorkspaceId}
              newWorkspaceName={newWorkspaceName}
              duplicateStrategy={duplicateStrategy}
              isNewWorkspace={isNewWorkspace}
              isNetscape={isNetscape}
              folderTree={folderTree}
              selectedFolders={selectedFolders}
              selectedCount={selectedCount}
              onWorkspaceChange={(value) => {
                if (value !== null) setTargetWorkspaceId(value);
              }}
              onWorkspaceNameChange={setNewWorkspaceName}
              onDuplicateStrategyChange={setDuplicateStrategy}
              onToggleFolder={toggleFolder}
            />
          )}

          {step === "importing" && (
            <ImportingStep progress={progress} fileName={file?.name ?? null} />
          )}

          {step === "done" && result && <DoneStep result={result} />}
        </div>

        {step !== "importing" && (
          <DialogFooter className="flex-row justify-end border-t border-border px-5 py-4">
            {step === "upload" && (
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
            )}

            {step === "preview" && (
              <>
                <Button variant="outline" onClick={goBack}>
                  Back
                </Button>
                <Button onClick={handleImport} disabled={importDisabled}>
                  {importLabel}
                </Button>
              </>
            )}

            {step === "done" && (
              <>
                <Button variant="outline" onClick={resetState}>
                  Import more
                </Button>
                <Button onClick={close}>Done</Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
