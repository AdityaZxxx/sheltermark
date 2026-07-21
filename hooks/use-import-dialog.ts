"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { importBookmarks, previewImport } from "~/app/action/import.action";
import { bookmarkKeys, workspaceKeys } from "~/lib/query-keys";

type ImportStep = "upload" | "preview" | "importing" | "done";

export interface PreviewData {
  totalBookmarks: number;
  validBookmarks: number;
  duplicates: number;
  workspaces: Array<{ name: string; count: number }>;
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

interface ImportOptions {
  targetWorkspaceId: string | null;
  createWorkspace: boolean;
  newWorkspaceName?: string;
  duplicateStrategy?: "skip" | "replace";
}

interface UseImportDialogReturn {
  step: ImportStep;
  file: File | null;
  fileType: "json" | "csv";
  preview: PreviewData | null;
  progress: number;
  targetWorkspaceId: string | "new";
  newWorkspaceName: string;
  duplicateStrategy: "skip" | "replace";
  result: ImportResult | null;
  isCheckingDuplicates: boolean;
  isNewWorkspace: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleImport: () => Promise<void>;
  handleClose: () => void;
  goBack: () => void;
  setTargetWorkspaceId: (value: string | "new") => void;
  setNewWorkspaceName: (value: string) => void;
  setDuplicateStrategy: (value: "skip" | "replace") => void;
  resetState: () => void;
}

export function useImportDialog(): UseImportDialogReturn {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [step, setStep] = useState<ImportStep>("upload");
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
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  const isNewWorkspace = targetWorkspaceId === "new";

  const getImportOptions = useCallback(
    (workspaceId: string | "new", workspaceName: string): ImportOptions => ({
      targetWorkspaceId: workspaceId !== "new" ? workspaceId : null,
      createWorkspace: workspaceId === "new",
      newWorkspaceName: workspaceId === "new" ? workspaceName : undefined,
    }),
    [],
  );

  const resetState = useCallback(() => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setProgress(0);
    setTargetWorkspaceId("new");
    setNewWorkspaceName("Imported - Browser");
    setDuplicateStrategy("skip");
    setResult(null);
    setIsCheckingDuplicates(false);
  }, []);

  const refreshPreview = useCallback(async () => {
    if (!file || step !== "preview") return;

    setIsCheckingDuplicates(true);
    const content = await file.text();
    const previewResult = await previewImport(
      content,
      fileType,
      getImportOptions(targetWorkspaceId, newWorkspaceName),
    );

    if (previewResult.success) {
      setPreview(previewResult.data);
    }
    setIsCheckingDuplicates(false);
  }, [
    file,
    step,
    fileType,
    targetWorkspaceId,
    newWorkspaceName,
    getImportOptions,
  ]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      try {
        const content = await selectedFile.text();
        const options = getImportOptions(targetWorkspaceId, newWorkspaceName);
        const previewResult = await previewImport(content, fileType, options);

        if (previewResult.success) {
          setPreview(previewResult.data);
          setStep("preview");
        } else {
          toast.error(previewResult.error);
        }
      } catch {
        toast.error("Failed to parse file");
      }
    },
    [targetWorkspaceId, newWorkspaceName, fileType, getImportOptions],
  );

  const handleImport = useCallback(async () => {
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

      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
      if (targetWorkspaceId === "new") {
        queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
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
  }, [
    file,
    fileType,
    targetWorkspaceId,
    duplicateStrategy,
    newWorkspaceName,
    queryClient,
  ]);

  const handleClose = useCallback(() => {
    resetState();
  }, [resetState]);

  const goBack = useCallback(() => {
    setStep("upload");
    setFile(null);
    setPreview(null);
  }, []);

  const debouncedRefreshPreview = useCallback(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => refreshPreview(), 300);
  }, [refreshPreview]);

  useEffect(() => {
    debouncedRefreshPreview();
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [debouncedRefreshPreview]);

  return {
    step,
    file,
    fileType,
    preview,
    progress,
    targetWorkspaceId,
    newWorkspaceName,
    duplicateStrategy,
    result,
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
    resetState,
  };
}
