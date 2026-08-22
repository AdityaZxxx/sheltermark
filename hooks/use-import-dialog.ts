"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { ImportFileType, ParsedBookmark } from "~/lib/import/parsers";

import { importBookmarks, previewImport } from "~/app/action/import.action";
import { type DetectedFormat, detectFormat } from "~/lib/import/detect";
import {
  bookmarkSurvivesFilter,
  type FolderNode,
  pathKey,
} from "~/lib/import/folder-filter";
import { parseImportFile } from "~/lib/import/parsers";
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
  /** Workspace the bookmarks were imported into, if known. */
  workspaceId?: string | null;
}

function collectAllFolderPaths(bookmarks: ParsedBookmark[]): Set<string> {
  const paths = new Set<string>();
  for (const bm of bookmarks) {
    const fp = bm.folderPath ?? [];
    for (let depth = 0; depth <= fp.length; depth++) {
      paths.add(pathKey(fp.slice(0, depth)));
    }
  }
  return paths;
}

function buildFolderTree(bookmarks: ParsedBookmark[]): FolderNode[] {
  const folderMap = new Map<string, FolderNode>();

  for (const bm of bookmarks) {
    const path = bm.folderPath ?? [];
    for (let depth = 0; depth <= path.length; depth++) {
      const ancestor = path.slice(0, depth);
      const key = pathKey(ancestor);
      const existing = folderMap.get(key);
      if (existing) {
        if (depth === path.length) {
          existing.directCount += 1;
        }
        existing.totalCount += 1;
      } else {
        folderMap.set(key, {
          path: ancestor,
          directCount: depth === path.length ? 1 : 0,
          totalCount: 1,
        });
      }
    }
  }

  return Array.from(folderMap.values()).toSorted((a, b) => {
    if (a.path.length !== b.path.length) return a.path.length - b.path.length;
    return a.path.join("/").localeCompare(b.path.join("/"));
  });
}

function getImportOptions(_workspaceId: string | "new", workspaceName: string) {
  return {
    targetWorkspaceId: _workspaceId !== "new" ? _workspaceId : null,
    createWorkspace: _workspaceId === "new",
    newWorkspaceName: _workspaceId === "new" ? workspaceName : undefined,
  };
}

type ParsedFileResult =
  | {
      ok: true;
      format: ImportFileType;
      bookmarks: ParsedBookmark[];
      preview: PreviewData;
    }
  | { ok: false };

async function selectAndParseFile(
  selectedFile: File,
  targetWorkspaceId: string | "new",
  newWorkspaceName: string,
): Promise<ParsedFileResult> {
  try {
    const content = await selectedFile.text();

    const format = detectFormat(content);
    if (format === "unknown") {
      toast.error(
        "Unsupported file format. Sheltermark supports browser bookmarks (HTML), Sheltermark JSON, and Sheltermark CSV.",
      );
      return { ok: false };
    }

    const previewResult = await previewImport(
      content,
      format,
      getImportOptions(targetWorkspaceId, newWorkspaceName),
    );
    if (!previewResult.success) {
      toast.error(previewResult.error);
      return { ok: false };
    }

    const localParse = parseImportFile(content, format);
    if (!localParse.success) {
      toast.error(localParse.error);
      return { ok: false };
    }

    return {
      ok: true,
      format,
      bookmarks: localParse.bookmarks,
      preview: previewResult.data,
    };
  } catch {
    toast.error("Failed to parse file");
    return { ok: false };
  }
}

interface UseImportDialogReturn {
  step: ImportStep;
  file: File | null;
  fileType: ImportFileType | null;
  detectedFormat: DetectedFormat | null;
  preview: PreviewData | null;
  progress: number;
  targetWorkspaceId: string | "new";
  newWorkspaceName: string;
  duplicateStrategy: "skip" | "replace";
  result: ImportResult | null;
  isCheckingDuplicates: boolean;
  isParsing: boolean;
  isNewWorkspace: boolean;
  /** All parsed bookmarks from the file (before folder filtering). */
  parsedBookmarks: ParsedBookmark[];
  /** Folder tree for browser imports; empty for JSON/CSV. */
  folderTree: FolderNode[];
  /** Set of currently-selection folder path keys. */
  selectedFolders: Set<string>;
  /** Number of bookmarks remaining after folder selection. */
  selectedCount: number;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleImport: () => Promise<void>;
  handleClose: () => void;
  goBack: () => void;
  setTargetWorkspaceId: (value: string | "new") => void;
  setNewWorkspaceName: (value: string) => void;
  setDuplicateStrategy: (value: "skip" | "replace") => void;
  toggleFolder: (path: string[]) => void;
}

export function useImportDialog(): UseImportDialogReturn {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<ImportFileType | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat | null>(
    null,
  );
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
  const [isParsing, setIsParsing] = useState(false);
  const [parsedBookmarks, setParsedBookmarks] = useState<ParsedBookmark[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(
    new Set(),
  );

  const isNewWorkspace = targetWorkspaceId === "new";

  const folderTree =
    fileType !== "netscape" ? [] : buildFolderTree(parsedBookmarks);

  const selectedCount =
    fileType !== "netscape"
      ? parsedBookmarks.length
      : parsedBookmarks.filter((bm) =>
          bookmarkSurvivesFilter(bm.folderPath, selectedFolders),
        ).length;

  const resetState = () => {
    setStep("upload");
    setFile(null);
    setFileType(null);
    setDetectedFormat(null);
    setPreview(null);
    setProgress(0);
    setTargetWorkspaceId("new");
    setNewWorkspaceName("Imported - Browser");
    setDuplicateStrategy("skip");
    setResult(null);
    setIsCheckingDuplicates(false);
    setIsParsing(false);
    setParsedBookmarks([]);
    setSelectedFolders(new Set());
  };

  // Debounced preview refresh: re-runs when any input to the preview changes.
  useEffect(() => {
    if (!file || step !== "preview" || !fileType) return;

    const timer = setTimeout(async () => {
      setIsCheckingDuplicates(true);
      const content = await file.text();
      const previewResult = await previewImport(content, fileType, {
        ...getImportOptions(targetWorkspaceId, newWorkspaceName),
        folderPaths:
          fileType === "netscape" ? Array.from(selectedFolders) : undefined,
      });

      if (previewResult.success) {
        setPreview(previewResult.data);
      }
      setIsCheckingDuplicates(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [
    file,
    step,
    fileType,
    targetWorkspaceId,
    newWorkspaceName,
    selectedFolders,
  ]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setIsParsing(true);
    const parsed = await selectAndParseFile(
      selectedFile,
      targetWorkspaceId,
      newWorkspaceName,
    );
    if (parsed.ok) {
      setFile(selectedFile);
      setFileType(parsed.format);
      setDetectedFormat(parsed.format);
      setPreview(parsed.preview);
      setParsedBookmarks(parsed.bookmarks);
      setSelectedFolders(collectAllFolderPaths(parsed.bookmarks));
      setStep("preview");
    }
    setIsParsing(false);
  };

  const handleImport = async () => {
    if (!file || !fileType) return;

    if (fileType === "netscape" && selectedCount === 0) {
      toast.error("Select at least one folder to import.");
      return;
    }

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
        folderPaths:
          fileType === "netscape" ? Array.from(selectedFolders) : undefined,
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
        workspaceId: targetWorkspaceId !== "new" ? targetWorkspaceId : null,
      });
      setStep("done");
      toast.success(`Imported ${importedData?.imported ?? 0} bookmarks`);
    } catch {
      toast.error("Import failed");
    }
  };

  const handleClose = () => {
    resetState();
  };

  const goBack = () => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setParsedBookmarks([]);
    setSelectedFolders(new Set());
  };

  const toggleFolder = (path: string[]) => {
    if (path.length === 0) {
      const allSelected = selectedCount === parsedBookmarks.length;
      if (allSelected) {
        setSelectedFolders(new Set());
      } else {
        setSelectedFolders(collectAllFolderPaths(parsedBookmarks));
      }
      return;
    }

    const subtree = parsedBookmarks.filter((bm) => {
      const bp = bm.folderPath ?? [];
      if (bp.length < path.length) return false;
      for (let i = 0; i < path.length; i++) {
        if (bp[i] !== path[i]) return false;
      }
      return true;
    });

    const subtreeFullySelected = subtree.every((bm) =>
      bookmarkSurvivesFilter(bm.folderPath, selectedFolders),
    );

    setSelectedFolders((prev) => {
      const next = new Set(prev);

      if (subtreeFullySelected) {
        for (const bm of subtree) {
          const bp = bm.folderPath ?? [];
          for (let depth = path.length - 1; depth < bp.length; depth++) {
            next.delete(pathKey(bp.slice(0, depth + 1)));
          }
        }
        next.delete(pathKey(path));
      } else {
        next.add(pathKey(path));
        for (const bm of subtree) {
          const bp = bm.folderPath ?? [];
          for (let depth = path.length - 1; depth < bp.length; depth++) {
            next.add(pathKey(bp.slice(0, depth + 1)));
          }
        }
      }

      return next;
    });
  };

  return {
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
    parsedBookmarks,
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
  };
}
