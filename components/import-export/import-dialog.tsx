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
    fileType,
    detectedFormat,
    preview,
    progress,
    result,
    targetWorkspaceId,
    newWorkspaceName,
    duplicateStrategy,
    isCheckingDuplicates,
    isParsing,
    isNewWorkspace,
    folderTree,
    selectedFolders,
    selectedCount,
    fileInputRef,
    handleFileChange,
    handleImport,
    handleClose,
    goBack,
    setTargetWorkspaceId,
    setNewWorkspaceName,
    setDuplicateStrategy,
    toggleFolder,
  } = useImportDialog();

  const isNetscape = fileType === "netscape";
  const importDisabled = isNetscape && selectedCount === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[95vh]">
        <DialogHeader>
          <DialogTitle>Import Bookmarks</DialogTitle>
          <DialogDescription>
            Import bookmarks from a JSON, CSV, or browser bookmarks file
            (Chrome, Firefox, Edge, Safari).
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <UploadStep
            file={file}
            fileInputRef={fileInputRef}
            detectedFormat={detectedFormat}
            isParsing={isParsing}
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
                disabled={
                  importDisabled ||
                  (isNewWorkspace ? !newWorkspaceName.trim() : false)
                }
              >
                {importDisabled
                  ? "Select at least one folder"
                  : `Import ${selectedCount > 0 ? selectedCount : ""}`.trim()}
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
