"use client";

import { SpinnerIcon, UploadSimpleIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { importBookmarks, previewImport } from "~/app/action/import";
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

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "upload" | "preview" | "importing" | "done";

interface PreviewData {
  totalBookmarks: number;
  validBookmarks: number;
  duplicates: number;
  workspaces: Array<{ name: string; count: number }>;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const { workspaces } = useWorkspaces();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<"json" | "csv">("json");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [progress, setProgress] = useState(0);
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string | "new">(
    "new",
  );
  const [newWorkspaceName, setNewWorkspaceName] =
    useState("Imported - Browser");
  const [duplicateStrategy, setDuplicateStrategy] = useState<
    "skip" | "replace"
  >("skip");
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  const resetState = () => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setProgress(0);
    setTargetWorkspaceId("new");
    setNewWorkspaceName("Imported - Browser");
    setDuplicateStrategy("skip");
    setResult(null);
    setIsCheckingDuplicates(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (extension === "json") {
      setFileType("json");
    } else if (extension === "csv") {
      setFileType("csv");
    } else {
      toast.error("Please upload a JSON or CSV file");
      return;
    }

    setFile(selectedFile);

    // Auto-preview after file selected
    try {
      const content = await selectedFile.text();
      const result = await previewImport(content, fileType, {
        targetWorkspaceId:
          targetWorkspaceId !== "new" ? targetWorkspaceId : null,
        createWorkspace: targetWorkspaceId === "new",
        newWorkspaceName:
          targetWorkspaceId === "new" ? newWorkspaceName : undefined,
      });

      if (result.success) {
        setPreview(result.data);
        setStep("preview");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to parse file");
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setStep("importing");
    setProgress(10);

    try {
      const content = await file.text();
      setProgress(30);

      const importResult = await importBookmarks(content, fileType, {
        targetWorkspaceId:
          targetWorkspaceId !== "new" ? targetWorkspaceId : undefined,
        duplicateStrategy,
        createWorkspace: targetWorkspaceId === "new",
        newWorkspaceName:
          targetWorkspaceId === "new" ? newWorkspaceName : undefined,
      });

      setProgress(100);

      if (!importResult.success) {
        toast.error(importResult.error);
        setStep("upload");
        return;
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      if (targetWorkspaceId === "new") {
        queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      }

      const importedData = importResult.data;
      setResult({
        imported: importedData?.imported ?? 0,
        skipped: importedData?.skipped ?? 0,
      });
      setStep("done");
      toast.success(`Imported ${importedData?.imported ?? 0} bookmarks`);
    } catch {
      toast.error("Import failed");
      setStep("upload");
    }
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const isNewWorkspace = targetWorkspaceId === "new";

  // Re-check duplicates when workspace selection changes
  useEffect(() => {
    if (step !== "preview" || !file) return;

    const updatePreview = async () => {
      setIsCheckingDuplicates(true);
      const content = await file.text();
      const result = await previewImport(content, fileType, {
        targetWorkspaceId:
          targetWorkspaceId !== "new" ? targetWorkspaceId : null,
        createWorkspace: targetWorkspaceId === "new",
        newWorkspaceName:
          targetWorkspaceId === "new" ? newWorkspaceName : undefined,
      });

      if (result.success) {
        setPreview(result.data);
      }
      setIsCheckingDuplicates(false);
    };

    const debounce = setTimeout(updatePreview, 300);
    return () => clearTimeout(debounce);
  }, [targetWorkspaceId, newWorkspaceName, step, file, fileType]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex flex-col max-h-[95vh]">
        <DialogHeader>
          <DialogTitle>Import Bookmarks</DialogTitle>
          <DialogDescription>
            Import bookmarks from a JSON or CSV file.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col gap-4 py-4">
            <label className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors w-full block">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <UploadSimpleIcon className="size-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {file ? file.name : "Click to upload JSON or CSV"}
              </p>
            </label>
          </div>
        )}

        {step === "preview" && preview && (
          <div className="flex flex-col gap-4 py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total bookmarks</span>
                <span className="font-medium">{preview.totalBookmarks}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Potential duplicates
                </span>
                <span className="font-medium">
                  {isCheckingDuplicates ? (
                    <SpinnerIcon className="animate-spin" />
                  ) : (
                    preview.duplicates
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Workspaces in file
                </span>
                <span className="font-medium">{preview.workspaces.length}</span>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-medium">Import to workspace</Label>
              <Select
                value={targetWorkspaceId}
                onValueChange={(value) => setTargetWorkspaceId(value as string)}
              >
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
                          {
                            workspaces.find((ws) => ws.id === targetWorkspaceId)
                              ?.name
                          }
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
                          className="w-2 h-2 rounded-full "
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
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
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
                  setDuplicateStrategy(value as "skip" | "replace")
                }
                className="flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="skip" id="dup-skip" />
                  <Label
                    htmlFor="dup-skip"
                    className="font-normal cursor-pointer"
                  >
                    Skip duplicates
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="replace" id="dup-replace" />
                  <Label
                    htmlFor="dup-replace"
                    className="font-normal cursor-pointer"
                  >
                    Replace duplicates
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col gap-4 py-8">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importing bookmarks...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="flex flex-col gap-4 py-4">
            <div className="text-center">
              <p className="text-lg font-medium">Import Complete</p>
              <p className="text-sm text-muted-foreground mt-1">
                {result.imported} imported, {result.skipped} skipped
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
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
